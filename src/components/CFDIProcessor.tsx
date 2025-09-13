"use client"

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Search, Trash, Settings, User, Users, Shield, AlertTriangle, X, Check, BarChart3, TrendingUp, DollarSign, Calendar, Award, Cloud, Wifi, WifiOff, RefreshCw, Database, CheckCircle, Edit, Plus } from 'lucide-react';

// Importar tipos y utilidades
import type { Usuario, FacturaData, SesionUsuario, DuplicadoDetectado, Metricas, TopCliente, TopAgente } from '@/lib/types';
import { safeString, safeLowerCase, safeNumber, encriptarDatos, desencriptarDatos } from '@/lib/crypto';
import { CFDI_SYSTEM_PROMPT } from '@/lib/constants';
import { 
  verificarSupabase, 
  guardarFacturaEnSupabase, 
  cargarFacturasDesdeLaNube, 
  eliminarFacturaDeSupabase,
  guardarUsuariosEnSupabase,
  cargarUsuariosDesdeLaNube,
  type EstadoSupabase
} from '@/lib/supabase';

export default function CFDIProcessor() {
  // Estados de autenticación
  const [sesionActual, setSesionActual] = useState<SesionUsuario | null>(null);
  const [mostrarLogin, setMostrarLogin] = useState(true);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [vistaActual, setVistaActual] = useState<'dashboard' | 'facturas' | 'usuarios'>('dashboard');

  // Estados de conexión
  const [conectadoAInternet, setConectadoAInternet] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>('');
  const [estadoSupabase, setEstadoSupabase] = useState<EstadoSupabase>('verificando');

  // Estados de login/registro
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registroData, setRegistroData] = useState({
    username: '', email: '', password: '', confirmarPassword: '', rol: 'usuario' as const
  });

  // Estados principales
  const [facturas, setFacturas] = useState<FacturaData[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof FacturaData>('fechaSubida');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [systemPrompt, setSystemPrompt] = useState(CFDI_SYSTEM_PROMPT);
  const [showSettings, setShowSettings] = useState(false);
  const [datosInicializados, setDatosInicializados] = useState(false);

  // Estados para selección múltiple
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<Set<string>>(new Set());
  const [seleccionarTodas, setSeleccionarTodas] = useState(false);

  // Estados para manejo de duplicados
  const [duplicadosDetectados, setDuplicadosDetectados] = useState<DuplicadoDetectado[]>([]);
  const [mostrarModalDuplicados, setMostrarModalDuplicados] = useState(false);

  // Detectar conexión a internet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const manejarConexion = () => setConectadoAInternet(navigator.onLine);
    
    window.addEventListener('online', manejarConexion);
    window.addEventListener('offline', manejarConexion);
    
    return () => {
      window.removeEventListener('online', manejarConexion);
      window.removeEventListener('offline', manejarConexion);
    };
  }, []);

  // Verificar conexión con Supabase
  const verificarConexionSupabase = useCallback(async () => {
    if (!conectadoAInternet) {
      setEstadoSupabase('error');
      return;
    }

    try {
      const estado = await verificarSupabase();
      setEstadoSupabase(estado);
    } catch (error) {
      setEstadoSupabase('error');
    }
  }, [conectadoAInternet]);

  // Función para crear una factura válida con valores por defecto
  const crearFacturaValida = (datos: any): FacturaData => {
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
  const detectarDuplicados = (nuevaFactura: FacturaData, facturasExistentes: FacturaData[]): DuplicadoDetectado | null => {
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

  // Gestión híbrida ULTRA ROBUSTA
  const guardarFacturas = useCallback(async (facturasParaGuardar: FacturaData[]) => {
    if (!sesionActual || !Array.isArray(facturasParaGuardar)) return;
    
    try {
      console.log(`💾 Guardando ${facturasParaGuardar.length} facturas...`);
      
      // 1. Limpiar y validar todas las facturas
      const facturasValidadas = facturasParaGuardar
        .filter(f => f && f.id)
        .map(factura => crearFacturaValida(factura));
      
      // 2. Guardar localmente SIEMPRE (backup)
      const facturasEncriptadas = await encriptarDatos(facturasValidadas, sesionActual.usuario.password);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cfdi_facturas', facturasEncriptadas);
      }
      console.log('📱 ✅ Backup local completado');

      // 3. Sincronizar individualmente con Supabase
      if (estadoSupabase === 'conectado') {
        setSincronizando(true);
        
        for (const factura of facturasValidadas) {
          if (!factura.sincronizado) {
            const sincronizado = await guardarFacturaEnSupabase(factura, sesionActual.usuario.password);
            if (sincronizado) {
              setFacturas(prev => prev.map(f => 
                f.id === factura.id ? { ...f, sincronizado: true } : f
              ));
            }
          }
        }
        
        setSincronizando(false);
      }
    } catch (error) {
      console.error('Error guardando facturas:', error);
    }
  }, [sesionActual, estadoSupabase]);

  const cargarFacturas = useCallback(async () => {
    if (!sesionActual || datosInicializados) return;
    
    let facturasCargadas: FacturaData[] = [];

    try {
      // 1. Intentar cargar desde Supabase primero
      if (estadoSupabase === 'conectado') {
        facturasCargadas = await cargarFacturasDesdeLaNube(sesionActual.usuario.id, sesionActual.usuario.password);
      }

      // 2. Si no hay datos en Supabase, cargar desde local
      if (facturasCargadas.length === 0 && typeof window !== 'undefined') {
        try {
          const facturasEncriptadas = localStorage.getItem('cfdi_facturas');
          if (facturasEncriptadas && facturasEncriptadas.length > 0) {
            const facturasDesencriptadas = await desencriptarDatos(facturasEncriptadas, sesionActual.usuario.password);
            
            if (Array.isArray(facturasDesencriptadas)) {
              facturasCargadas = facturasDesencriptadas
                .filter(f => f && f.id)
                .map(factura => crearFacturaValida({
                  ...factura,
                  sincronizado: false
                }));
              
              console.log('📱 Facturas cargadas y validadas desde local:', facturasCargadas.length);
              
              // Auto-sincronizar si es posible
              if (estadoSupabase === 'conectado' && facturasCargadas.length > 0) {
                console.log('🔄 Auto-sincronizando facturas individuales...');
                setTimeout(() => {
                  facturasCargadas.forEach(factura => {
                    if (!factura.sincronizado) {
                      guardarFacturaEnSupabase(factura, sesionActual.usuario.password);
                    }
                  });
                }, 3000);
              }
            }
          }
        } catch (error) {
          console.error('Error cargando facturas localmente:', error);
          // Limpiar datos corruptos
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cfdi_facturas');
          }
          console.log('🧹 Datos locales corruptos eliminados');
          facturasCargadas = [];
        }
      }
    } catch (error) {
      console.error('Error general cargando facturas:', error);
      facturasCargadas = [];
    }

    setFacturas(facturasCargadas);
    setDatosInicializados(true);
  }, [sesionActual, datosInicializados, estadoSupabase]);

  const cargarUsuarios = useCallback(async () => {
    if (!sesionActual) return;
    
    let usuariosCargados: Usuario[] = [];

    try {
      // Intentar cargar desde Supabase primero
      if (estadoSupabase === 'conectado') {
        usuariosCargados = await cargarUsuariosDesdeLaNube(sesionActual.usuario.password);
      }

      // Si no hay datos en Supabase, cargar desde local
      if (usuariosCargados.length === 0 && typeof window !== 'undefined') {
        try {
          const usuariosEncriptados = localStorage.getItem('cfdi_usuarios');
          if (usuariosEncriptados) {
            usuariosCargados = await desencriptarDatos(usuariosEncriptados, sesionActual.usuario.password);
            console.log('📱 Usuarios cargados desde local:', usuariosCargados.length);
            
            // Auto-sincronizar usuarios si es posible
            if (estadoSupabase === 'conectado' && usuariosCargados.length > 0) {
              await guardarUsuariosEnSupabase(usuariosCargados, sesionActual.usuario.password);
            }
          }
        } catch (error) {
          console.error('Error cargando usuarios localmente:', error);
          usuariosCargados = [];
        }
      }
    } catch (error) {
      console.error('Error general cargando usuarios:', error);
      usuariosCargados = [];
    }

    setUsuarios(usuariosCargados);
  }, [sesionActual, estadoSupabase]);

  const guardarUsuarios = async (usuariosActualizados: Usuario[]) => {
    if (sesionActual) {
      try {
        // Guardar localmente
        const usuariosEncriptados = await encriptarDatos(usuariosActualizados, sesionActual.usuario.password);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cfdi_usuarios', usuariosEncriptados);
        }
        setUsuarios(usuariosActualizados);
        
        // Sincronizar con Supabase
        if (estadoSupabase === 'conectado') {
          await guardarUsuariosEnSupabase(usuariosActualizados, sesionActual.usuario.password);
        }
      } catch (error) {
        console.error('Error guardando usuarios:', error);
      }
    }
  };

  const inicializarUsuarioAdmin = async () => {
    try {
      if (typeof window === 'undefined') return;
      
      const usuariosExistentes = localStorage.getItem('cfdi_usuarios');
      if (!usuariosExistentes) {
        const adminUser: Usuario = {
          id: 'admin-001',
          username: 'admin',
          email: 'admin@empresa.com',
          password: 'admin123',
          rol: 'admin',
          fechaCreacion: new Date().toISOString(),
          ultimoAcceso: new Date().toISOString(),
          activo: true
        };

        const usuariosEncriptados = await encriptarDatos([adminUser], 'admin123');
        localStorage.setItem('cfdi_usuarios', usuariosEncriptados);
        
        // Sincronizar con Supabase si está disponible
        if (estadoSupabase === 'conectado') {
          await guardarUsuariosEnSupabase([adminUser], 'admin123');
        }
        
        console.log('👤 Usuario admin inicializado');
      }
    } catch (error) {
      console.error('Error inicializando usuario admin:', error);
    }
  };

  // Icono de loading animado
  const LoadingSpinner = () => (
    <div className="inline-flex items-center">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
    </div>
  );

  // Indicador de estado completo
  const IndicadorEstado = () => (
    <div className="flex items-center gap-3">
      {conectadoAInternet ? (
        <div className="flex items-center gap-1 text-green-600">
          <Wifi className="w-4 h-4" />
          <span className="text-xs font-medium">Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs font-medium">Offline</span>
        </div>
      )}
      
      <div className={`flex items-center gap-1 ${
        estadoSupabase === 'conectado' ? 'text-green-600' :
        estadoSupabase === 'verificando' ? 'text-blue-600' : 'text-red-600'
      }`}>
        <Database className="w-4 h-4" />
        <span className="text-xs font-medium">
          {estadoSupabase === 'conectado' ? 'Supabase ✓' :
           estadoSupabase === 'verificando' ? 'Conectando...' : 'Sin BD'}
        </span>
      </div>
      
      {sincronizando && (
        <div className="flex items-center gap-1 text-blue-600">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Sincronizando...</span>
        </div>
      )}
      
      {ultimaSincronizacion && estadoSupabase === 'conectado' && (
        <div className="flex items-center gap-1 text-gray-500">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs">
            Última sync: {new Date(ultimaSincronizacion).toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      )}
    </div>
  );

  // Funciones de autenticación
  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let usuariosDisponibles: Usuario[] = [];

      // 1. Intentar cargar desde Supabase primero
      if (estadoSupabase === 'conectado') {
        console.log('☁️ Intentando login desde Supabase...');
        usuariosDisponibles = await cargarUsuariosDesdeLaNube(loginData.password);
      }

      // 2. Si no hay datos en Supabase, usar localStorage
      if (usuariosDisponibles.length === 0 && typeof window !== 'undefined') {
        try {
          const usuariosEncriptados = localStorage.getItem('cfdi_usuarios');
          if (usuariosEncriptados) {
            usuariosDisponibles = await desencriptarDatos(usuariosEncriptados, loginData.password);
            console.log('📱 Login usando datos locales');
          }
        } catch (error) {
          console.error('Error cargando usuarios locales:', error);
          usuariosDisponibles = [];
        }
      }

      const usuario = usuariosDisponibles.find((u: Usuario) => 
        u && u.username === loginData.username && u.password === loginData.password && u.activo
      );

      if (usuario) {
        const sesion: SesionUsuario = {
          usuario,
          fechaLogin: new Date().toISOString(),
          ultimaActividad: new Date().toISOString()
        };
        
        setSesionActual(sesion);
        setMostrarLogin(false);
        
        console.log(`✅ Login exitoso: ${usuario.username} (${usuario.rol})`);
        
        // Actualizar último acceso y sincronizar
        usuario.ultimoAcceso = new Date().toISOString();
        const usuariosActualizados = usuariosDisponibles.map((u: Usuario) => 
          u.id === usuario.id ? usuario : u
        );
        await guardarUsuarios(usuariosActualizados);
      } else {
        alert('Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Error en el login:', error);
      alert('Error en el login. Verifica tus credenciales.');
    }
  };

  const manejarLogout = () => {
    setSesionActual(null);
    setMostrarLogin(true);
    setFacturas([]);
    setUsuarios([]);
    setDatosInicializados(false);
    setVistaActual('dashboard');
    setFacturasSeleccionadas(new Set());
    setUsuarioEditando(null);
  };

  // Funciones de permisos
  const puedeSubirFacturas = () => {
    return sesionActual?.usuario.rol === 'admin' || sesionActual?.usuario.rol === 'usuario';
  };

  const puedeExportar = () => {
    return sesionActual?.usuario.rol === 'admin' || sesionActual?.usuario.rol === 'usuario';
  };

  const puedeGestionarUsuarios = () => {
    return sesionActual?.usuario.rol === 'admin';
  };

  const esAdmin = () => {
    return sesionActual?.usuario.rol === 'admin';
  };

  // Métricas del Dashboard SEGURAS
  const metricas: Metricas = useMemo(() => {
    try {
      if (!Array.isArray(facturas)) return {
        totalFacturas: 0, totalImporte: 0, totalIVA: 0, promedioFactura: 0,
        facturasEsteMes: 0, clientesActivos: 0, agentesActivos: 0
      };

      const facturasCompletadas = facturas.filter(f => f && f.status === 'completed');
      const totalImporte = facturasCompletadas.reduce((sum, f) => sum + safeNumber(f.total), 0);
      const totalIVA = facturasCompletadas.reduce((sum, f) => sum + safeNumber(f.iva), 0);
      const promedioFactura = facturasCompletadas.length > 0 ? totalImporte / facturasCompletadas.length : 0;
      
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const facturasEsteMes = facturasCompletadas.filter(f => {
        try {
          return f.fecha && new Date(f.fecha) >= inicioMes;
        } catch {
          return false;
        }
      }).length;
      
      const clientesUnicos = new Set(
        facturasCompletadas
          .map(f => safeString(f.rfcReceptor))
          .filter(rfc => rfc && rfc.length > 0)
      ).size;
      
      const agentesUnicos = new Set(
        facturasCompletadas
          .map(f => safeString(f.agente))
          .filter(agente => agente && agente.length > 0)
      ).size;
      
      return {
        totalFacturas: facturasCompletadas.length,
        totalImporte,
        totalIVA,
        promedioFactura,
        facturasEsteMes,
        clientesActivos: clientesUnicos,
        agentesActivos: agentesUnicos
      };
    } catch (error) {
      console.error('Error calculando métricas:', error);
      return {
        totalFacturas: 0, totalImporte: 0, totalIVA: 0, promedioFactura: 0,
        facturasEsteMes: 0, clientesActivos: 0, agentesActivos: 0
      };
    }
  }, [facturas]);

  // Inicialización con manejo de errores
  useEffect(() => {
    try {
      verificarConexionSupabase();
      inicializarUsuarioAdmin();
    } catch (error) {
      console.error('Error en inicialización:', error);
    }
  }, [verificarConexionSupabase]);

  useEffect(() => {
    try {
      if (sesionActual && !datosInicializados) {
        cargarUsuarios();
        cargarFacturas();
      }
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    }
  }, [sesionActual, cargarUsuarios, cargarFacturas, datosInicializados]);

  // Pantalla de Login
  if (mostrarLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl flex items-center justify-center gap-3 font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <Shield className="w-10 h-10 text-blue-600" />
              CFDI Processor
            </CardTitle>
            <CardDescription className="flex flex-col items-center gap-3 text-gray-600 mt-2">
              <span className="text-lg">Sistema Empresarial Avanzado</span>
              <span className="text-sm">Procesamiento IA • Sincronización en la Nube • Análisis Financiero</span>
              <IndicadorEstado />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={manejarLogin} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-gray-700 font-medium">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  placeholder="Ingresa tu usuario"
                  required
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-700 font-medium">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  placeholder="Ingresa tu contraseña"
                  required
                  className="mt-1 h-11"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold" 
                disabled={estadoSupabase === 'verificando'}
              >
                {estadoSupabase === 'verificando' ? 'Conectando...' : 'Iniciar Sesión'}
              </Button>
            </form>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-700 font-semibold mb-2">👤 Credenciales de prueba:</p>
              <div className="space-y-1">
                <p className="text-xs text-blue-600 font-mono">Usuario: <span className="bg-blue-100 px-2 py-0.5 rounded">admin</span></p>
                <p className="text-xs text-blue-600 font-mono">Contraseña: <span className="bg-blue-100 px-2 py-0.5 rounded">admin123</span></p>
              </div>
            </div>

            <div className={`mt-4 p-4 rounded-xl border ${
              estadoSupabase === 'conectado' ? 'bg-green-50 border-green-200' : 
              estadoSupabase === 'verificando' ? 'bg-blue-50 border-blue-200' :
              'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5" />
                <div>
                  <p className={`text-sm font-medium ${
                    estadoSupabase === 'conectado' ? 'text-green-700' :
                    estadoSupabase === 'verificando' ? 'text-blue-700' :
                    'text-orange-700'
                  }`}>
                    {estadoSupabase === 'conectado' ? 
                      '🚀 Supabase Conectado' :
                      estadoSupabase === 'verificando' ?
                      '🔍 Conectando con Supabase...' :
                      '⚠️ Modo Local Únicamente'
                    }
                  </p>
                  <p className={`text-xs ${
                    estadoSupabase === 'conectado' ? 'text-green-600' :
                    estadoSupabase === 'verificando' ? 'text-blue-600' :
                    'text-orange-600'
                  }`}>
                    {estadoSupabase === 'conectado' ? 
                      'Sincronización automática • Acceso multi-dispositivo • Backup en la nube' :
                      estadoSupabase === 'verificando' ?
                      'Verificando conexión con base de datos...' :
                      'Funciona sin conexión • Los datos se guardan localmente'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard Principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con navegación */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  <Shield className="w-8 h-8 text-green-600" />
                  Procesador de Facturas CFDI
                </CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-700">
                      {safeString(sesionActual?.usuario.username)} | {
                        sesionActual?.usuario.rol === 'admin' ? '🔧 Administrador' :
                        sesionActual?.usuario.rol === 'usuario' ? '👤 Usuario' : '👁️ Solo Lectura'
                      }
                    </span>
                  </div>
                  <IndicadorEstado />
                </CardDescription>
              </div>
              <div className="flex gap-3">
                {duplicadosDetectados.length > 0 && (
                  <Button 
                    variant="destructive"
                    onClick={() => setMostrarModalDuplicados(true)}
                    className="flex items-center gap-2 animate-pulse"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {duplicadosDetectados.length} Duplicados
                  </Button>
                )}
                
                {estadoSupabase === 'conectado' && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      console.log('🔄 Sincronización manual iniciada...');
                      if (Array.isArray(usuarios) && usuarios.length > 0) {
                        guardarUsuariosEnSupabase(usuarios, sesionActual!.usuario.password);
                      }
                      if (Array.isArray(facturas) && facturas.length > 0) {
                        facturas.forEach(factura => {
                          if (factura && !factura.sincronizado) {
                            guardarFacturaEnSupabase(factura, sesionActual!.usuario.password);
                          }
                        });
                      }
                    }}
                    disabled={sincronizando}
                    className="flex items-center gap-2 hover:bg-blue-50 border-blue-200"
                    title="Forzar sincronización manual con Supabase"
                  >
                    <Cloud className="w-4 h-4" />
                    {sincronizando ? 'Sincronizando...' : 'Forzar Sync'}
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={manejarLogout}
                  className="flex items-center gap-2 hover:bg-red-50 border-red-200"
                >
                  <User className="w-4 h-4" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button 
                variant={vistaActual === 'dashboard' ? 'default' : 'outline'}
                onClick={() => setVistaActual('dashboard')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant={vistaActual === 'facturas' ? 'default' : 'outline'}
                onClick={() => setVistaActual('facturas')}
                className="flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Facturas ({Array.isArray(facturas) ? facturas.filter(f => f && f.status === 'completed').length : 0})
              </Button>
              {puedeGestionarUsuarios() && (
                <Button 
                  variant={vistaActual === 'usuarios' ? 'default' : 'outline'}
                  onClick={() => setVistaActual('usuarios')}
                  className="flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Usuarios ({Array.isArray(usuarios) ? usuarios.length : 0})
                </Button>
              )}
            </div>

            {/* Banner de estado de sincronización */}
            <div className={`p-4 rounded-xl border ${
              estadoSupabase === 'conectado' ? 'bg-green-50 border-green-200' :
              estadoSupabase === 'verificando' ? 'bg-blue-50 border-blue-200' :
              'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6" />
                  <div>
                    <p className={`text-sm font-semibold ${
                      estadoSupabase === 'conectado' ? 'text-green-700' :
                      estadoSupabase === 'verificando' ? 'text-blue-700' :
                      'text-orange-700'
                    }`}>
                      {estadoSupabase === 'conectado' ? 
                        '☁️ Sincronización Activa - Base de Datos en la Nube' :
                        estadoSupabase === 'verificando' ?
                        '🔍 Conectando con Supabase...' :
                        '⚠️ Modo Local - Sin Conexión a la Nube'
                      }
                    </p>
                    <p className={`text-xs ${
                      estadoSupabase === 'conectado' ? 'text-green-600' :
                      estadoSupabase === 'verificando' ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {estadoSupabase === 'conectado' ? 
                        'Cada factura se guarda individualmente • Acceso desde cualquier dispositivo • Backup automático' :
                        estadoSupabase === 'verificando' ?
                        'Verificando conexión con base de datos en la nube...' :
                        'Datos almacenados localmente • Se sincronizará cuando haya conexión'
                      }
                    </p>
                  </div>
                </div>
                {estadoSupabase === 'conectado' && Array.isArray(facturas) && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">
                      {facturas.filter(f => f && f.sincronizado).length}/{facturas.length} sincronizadas
                    </div>
                    <div className="text-xs text-green-500">
                      {facturas.length - facturas.filter(f => f && f.sincronizado).length > 0 
                        ? `${facturas.length - facturas.filter(f => f && f.sincronizado).length} pendientes` 
                        : 'Todo sincronizado'
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard - Vista Principal */}
        {vistaActual === 'dashboard' && (
          <div className="space-y-6">
            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium opacity-90">Total Facturado</CardTitle>
                    <DollarSign className="w-6 h-6 opacity-80" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    ${metricas.totalImporte.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-green-100 text-sm">
                    {metricas.totalFacturas} facturas procesadas
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium opacity-90">Total Facturas</CardTitle>
                    <Calendar className="w-6 h-6 opacity-80" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">{metricas.totalFacturas.toLocaleString()}</div>
                  <p className="text-blue-100 text-sm">
                    {metricas.facturasEsteMes} este mes
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium opacity-90">IVA Total</CardTitle>
                    <TrendingUp className="w-6 h-6 opacity-80" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    ${metricas.totalIVA.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-orange-100 text-sm">
                    Impuestos trasladados
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium opacity-90">Promedio Factura</CardTitle>
                    <Award className="w-6 h-6 opacity-80" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    ${metricas.promedioFactura.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-purple-100 text-sm">
                    {metricas.clientesActivos} clientes activos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Mensaje de Bienvenida si no hay datos */}
            {facturas.length === 0 && (
              <Card className="border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50">
                <CardContent className="py-16 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-700">¡Bienvenido a CFDI Processor!</h3>
                    <p className="text-gray-600 max-w-md">
                      Comienza subiendo tus primeras facturas CFDI para ver análisis completos, 
                      métricas financieras y reportes avanzados.
                    </p>
                    {puedeSubirFacturas() && (
                      <Button 
                        onClick={() => setVistaActual('facturas')} 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        Subir Primeras Facturas
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Vista de Facturas - Placeholder por ahora */}
        {vistaActual === 'facturas' && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-6 h-6 text-blue-600" />
                Gestión de Facturas CFDI
              </CardTitle>
              <CardDescription>
                Procesamiento inteligente con IA • Detección de duplicados • Sincronización automática
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Módulo de Facturas</h3>
                <p className="text-gray-600 mb-4">
                  Aquí podrás subir, procesar y gestionar todas tus facturas CFDI
                </p>
                <div className="text-sm text-gray-500">
                  🚧 Implementación en progreso...
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vista de Usuarios - Solo para Admins */}
        {vistaActual === 'usuarios' && puedeGestionarUsuarios() && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription>
                Control de acceso • Roles y permisos • Actividad de usuarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Panel de Administración</h3>
                <p className="text-gray-600 mb-4">
                  Gestión completa de usuarios del sistema
                </p>
                <div className="text-sm text-gray-500">
                  👥 {usuarios.length} usuarios registrados
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}