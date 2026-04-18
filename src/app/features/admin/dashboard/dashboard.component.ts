import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { SupabaseService } from '../../../core/supabase.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgChartsModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);

  // Stats
  totalConfirmedValue = signal<number>(0);
  activeReservations = signal<number>(0);
  recentFeed = signal<any[]>([]);

  // Chart config
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#735858', // Lamour Stone
          font: { family: 'Noto Serif', size: 10 }
        }
      }
    },
    scales: {
      y: { ticks: { color: '#735858' }, grid: { color: '#F5D1D133' } }, 
      x: { ticks: { color: '#735858' }, grid: { display: false } }
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartConfiguration['data'] = {
    labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
    datasets: [
      { data: [12, 19, 3, 5, 2, 3, 9], label: 'Citas fitting', backgroundColor: '#F5D1D1' }, // Blush
      { data: [1, 2, 8, 4, 5, 6, 2], label: 'Apartados confirmados', backgroundColor: '#775a19' } // Gold
    ]
  };

  async ngOnInit() {
    await this.loadMetrics();
  }

  async loadMetrics() {
    try {
      const { data: resData, error: resError } = await this.supabase.client
        .from('reservations')
        .select('*, products(price)')
        .order('created_at', { ascending: false });

      if (resData) {
        this.activeReservations.set(resData.filter(r => r.status === 'pendiente' || r.status === 'pagado').length);

        const total = resData
          .filter(r => r.status === 'pagado' || r.status === 'entregado' || r.status === 'finalizado')
          .reduce((acc, curr) => acc + (curr.products?.price || 0), 0);
        
        this.totalConfirmedValue.set(total);
        
        // Feed format
        this.recentFeed.set(resData.slice(0, 5).map(r => ({
          title: `Solicitud: ${r.customer_name}`,
          time: new Date(r.created_at).toLocaleDateString(),
          desc: `Pieza: ${r.products?.name || 'Varios'} | Estado: ${r.status}`
        })));
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics', err);
    }
  }
}
