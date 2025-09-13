import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { FacturaData, DuplicadoDetectado } from './types';
import { safeLowerCase, safeString, safeNumber } from './crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Función para crear una factura válida con valores por defecto
export const crearFacturaValida = (datos: any): FacturaData => {
  return {
    id: safeString(datos.id) || Date.now().toString(),
    fileName: safeString(datos.fileName),
    rfcEmisor: safeString(datos.rfcEmisor),
    nombreEmisor: safeString(datos.nombreEmisor),
    rfcReceptor: safeString(datos.rfcReceptor),
    nombreReceptor: safeString(datos.nombreReceptor),
    fecha: safeString(datos.fecha),
    folio: safeString(datos.folio),
    serie: safeString(datos.serie),
    uuid: safeString(datos.uuid),
    tipoComprobante: safeString(datos.tipoComprobante),
    moneda: safeString(datos.moneda),
    subtotal: safeNumber(datos.subtotal),
    total: safeNumber(datos.total),
    iva: safeNumber(datos.iva),
    isr: safeNumber(datos.isr),
    conceptos: safeString(datos.conceptos),
    metodoPago: safeString(datos.metodoPago),
    formaPago: safeString(datos.formaPago),
    usoCFDI: safeString(datos.usoCFDI),
    agente: safeString(datos.agente),
    status: datos.status || 'completed',
    usuarioId: safeString(datos.usuarioId),
    fechaSubida: safeString(datos.fechaSubida) || new Date().toISOString(),
    duplicadoDe: safeString(datos.duplicadoDe),
    tipoDuplicado: datos.tipoDuplicado,
    sincronizado: Boolean(datos.sincronizado)
  };
};

// Funciones de detección de duplicados SEGURAS
export const detectarDuplicados = (nuevaFactura: FacturaData, facturasExistentes: FacturaData[]): DuplicadoDetectado | null => {
  try {
    if (!nuevaFactura || !Array.isArray(facturasExistentes)) return null;

    const facturaExistente = facturasExistentes.find(f => {
      if (!f || f.id === nuevaFactura.id) return false;
      
      const folioNuevo = safeLowerCase(nuevaFactura.folio).trim();
      const folioExistente = safeLowerCase(f.folio).trim();
      const folioCoincide = folioNuevo && folioExistente && folioNuevo === folioExistente;
      
      const archivoNuevo = safeLowerCase(nuevaFactura.fileName);
      const archivoExistente = safeLowerCase(f.fileName);
      const archivoCoincide = archivoNuevo === archivoExistente;
      
      return folioCoincide || archivoCoincide;
    });

    if (facturaExistente) {
      const folioNuevo = safeLowerCase(nuevaFactura.folio).trim();
      const folioExistente = safeLowerCase(facturaExistente.folio).trim();
      const folioCoincide = folioNuevo && folioExistente && folioNuevo === folioExistente;
      
      const archivoNuevo = safeLowerCase(nuevaFactura.fileName);
      const archivoExistente = safeLowerCase(facturaExistente.fileName);
      const archivoCoincide = archivoNuevo === archivoExistente;
      
      let tipoDuplicado: 'folio' | 'archivo' | 'ambos';
      if (folioCoincide && archivoCoincide) {
        tipoDuplicado = 'ambos';
      } else if (folioCoincide) {
        tipoDuplicado = 'folio';
      } else {
        tipoDuplicado = 'archivo';
      }

      return {
        nuevaFactura,
        facturaExistente,
        tipoDuplicado
      };
    }

    return null;
  } catch (error) {
    console.error('Error detectando duplicados:', error);
    return null;
  }
};

// Convertir archivo a base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

// Formatear moneda mexicana
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Formatear fecha en español
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Formatear fecha y hora
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// Truncar texto
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};