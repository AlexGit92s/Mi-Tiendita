import { PrintRenderRequest } from '../models/print.types';
import { renderApartado80mm } from '../thermal-80mm/apartado-80mm.template';

export function renderApartado58mm(request: PrintRenderRequest): string {
  return renderApartado80mm({
    ...request,
    settings: {
      ...request.settings,
      fontSize: Math.min(request.settings.fontSize, 10),
      margins: {
        top: 2,
        right: 2,
        bottom: 2,
        left: 2
      }
    }
  });
}
