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
      { data: [0, 0, 0, 0, 0, 0, 0], label: 'Apartados creados', backgroundColor: '#F5D1D1' },
      { data: [0, 0, 0, 0, 0, 0, 0], label: 'Pagos confirmados', backgroundColor: '#775a19' }
    ]
  };

  async ngOnInit() {
    await this.loadMetrics();
  }

  async loadMetrics() {
    try {
      const { data: resData } = await this.supabase.client
        .from('reservations')
        .select('*, products(price)')
        .order('created_at', { ascending: false });

      if (resData) {
        this.activeReservations.set(resData.filter(r => r.status === 'pendiente' || r.status === 'pagado').length);

        const total = resData
          .filter(r => r.status === 'pagado' || r.status === 'entregado' || r.status === 'finalizado')
          .reduce((acc, curr) => acc + (curr.products?.price || 0), 0);

        this.totalConfirmedValue.set(total);

        this.recentFeed.set(resData.slice(0, 5).map(r => ({
          title: `Solicitud: ${r.customer_name}`,
          time: new Date(r.created_at).toLocaleDateString(),
          desc: `Pieza: ${r.products?.name || 'Varios'} | Estado: ${r.status}`
        })));

        this.buildWeeklyChart(resData);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics', err);
    }
  }

  private buildWeeklyChart(reservations: any[]) {
    const mondayStart = this.getMondayStart(new Date());
    const dayMs = 86_400_000;
    const weekEndExcl = mondayStart + 7 * dayMs;

    const created = [0, 0, 0, 0, 0, 0, 0];
    const confirmed = [0, 0, 0, 0, 0, 0, 0];

    for (const r of reservations) {
      const createdTs = r.created_at ? new Date(r.created_at).getTime() : NaN;
      if (!isNaN(createdTs) && createdTs >= mondayStart && createdTs < weekEndExcl) {
        const idx = Math.floor((createdTs - mondayStart) / dayMs);
        created[idx]++;
      }

      const confirmedTs = r.deposit_confirmed_at ? new Date(r.deposit_confirmed_at).getTime() : NaN;
      if (!isNaN(confirmedTs) && confirmedTs >= mondayStart && confirmedTs < weekEndExcl) {
        const idx = Math.floor((confirmedTs - mondayStart) / dayMs);
        confirmed[idx]++;
      }
    }

    this.barChartData = {
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
      datasets: [
        { data: created, label: 'Apartados creados', backgroundColor: '#F5D1D1' },
        { data: confirmed, label: 'Pagos confirmados', backgroundColor: '#775a19' }
      ]
    };
  }

  private getMondayStart(reference: Date): number {
    const d = new Date(reference);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - offset);
    return d.getTime();
  }
}
