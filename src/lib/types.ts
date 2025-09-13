export interface Usuario {
  id: string;
  username: string;
  email: string;
  password: string;
  rol: 'admin' | 'usuario' | 'solo-lectura';
  fechaCreacion: string;
  ultimoAcceso: string;
  activo: boolean;
}

export interface FacturaData {
  id: string;
  fileName: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  fecha: string;
  folio: string;
  serie: string;
  uuid: string;
  tipoComprobante: string;
  moneda: string;
  subtotal: number;
  total: number;
  iva: number;
  isr: number;
  conceptos: string;
  metodoPago: string;
  formaPago: string;
  usoCFDI: string;
  agente: string;
  status: 'processing' | 'completed' | 'error' | 'duplicate';
  usuarioId: string;
  fechaSubida: string;
  duplicadoDe?: string;
  tipoDuplicado?: 'folio' | 'archivo' | 'ambos';
  sincronizado?: boolean;
}

export interface SesionUsuario {
  usuario: Usuario;
  fechaLogin: string;
  ultimaActividad: string;
}

export interface DuplicadoDetectado {
  nuevaFactura: FacturaData;
  facturaExistente: FacturaData;
  tipoDuplicado: 'folio' | 'archivo' | 'ambos';
}

export interface Metricas {
  totalFacturas: number;
  totalImporte: number;
  totalIVA: number;
  promedioFactura: number;
  facturasEsteMes: number;
  clientesActivos: number;
  agentesActivos: number;
}

export interface TopCliente {
  nombre: string;
  rfc: string;
  total: number;
  facturas: number;
}

export interface TopAgente {
  nombre: string;
  total: number;
  facturas: number;
  promedio: number;
}