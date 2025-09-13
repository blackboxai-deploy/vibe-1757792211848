import { FacturaData, Usuario } from './types';
import { encriptarDatos, desencriptarDatos } from './crypto';

// Configuración de Supabase
export const SUPABASE_URL = 'https://kayxffncwpfvhbncswrt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtheXhmZm5jd3BmdmhibmNzd3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NzQ3ODEsImV4cCI6MjA3MzM1MDc4MX0.6fimwDB1I5SHZihTHDaDz9ZwJx8v78tqlkXza1JEX9I';

export type EstadoSupabase = 'verificando' | 'conectado' | 'error';

export const verificarSupabase = async (): Promise<EstadoSupabase> => {
  try {
    console.log('🔍 Verificando Supabase...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_cfdi?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (response.ok) {
      console.log('✅ Supabase conectado correctamente');
      return 'conectado';
    } else {
      console.error('❌ Error en Supabase:', response.status);
      return 'error';
    }
  } catch (error) {
    console.error('❌ Error conectando con Supabase:', error);
    return 'error';
  }
};

export const guardarFacturaEnSupabase = async (factura: FacturaData, password: string): Promise<boolean> => {
  try {
    console.log(`💾 Guardando factura individual: ${factura.folio || factura.fileName}`);
    
    const facturaEncriptada = await encriptarDatos(factura, password);
    
    const payload = {
      id: factura.id,
      user_id: factura.usuarioId,
      datos_encriptados: facturaEncriptada,
      ultima_actualizacion: new Date().toISOString()
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/facturas_cfdi`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Factura ${factura.folio} sincronizada individualmente`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Error guardando factura:`, response.status, errorText);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error sincronizando factura:`, error);
    return false;
  }
};

export const cargarFacturasDesdeLaNube = async (userId: string, password: string): Promise<FacturaData[]> => {
  try {
    console.log('☁️ Cargando facturas individuales desde Supabase...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/facturas_cfdi?user_id=eq.${userId}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`📥 ${data.length} facturas encontradas en Supabase`);
      
      const facturasDesencriptadas: FacturaData[] = [];
      
      for (const registro of data) {
        if (registro && registro.datos_encriptados) {
          try {
            const facturaDesencriptada = await desencriptarDatos(registro.datos_encriptados, password);
            facturasDesencriptadas.push({
              ...facturaDesencriptada,
              sincronizado: true
            });
          } catch (error) {
            console.error('Error desencriptando factura individual:', registro.id, error);
          }
        }
      }
      
      console.log(`☁️ ${facturasDesencriptadas.length} facturas cargadas exitosamente`);
      return facturasDesencriptadas;
    }
  } catch (error) {
    console.error('❌ Error cargando facturas desde Supabase:', error);
  }

  return [];
};

export const eliminarFacturaDeSupabase = async (facturaId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/facturas_cfdi?id=eq.${facturaId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Error eliminando factura de Supabase:', error);
    return false;
  }
};

export const guardarUsuariosEnSupabase = async (usuarios: Usuario[], password: string): Promise<boolean> => {
  try {
    console.log('👥 Sincronizando usuarios con Supabase...');
    
    const usuariosEncriptados = await encriptarDatos(usuarios, password);
    
    const payload = {
      id: 'usuarios_sistema',
      datos_encriptados: usuariosEncriptados,
      ultima_actualizacion: new Date().toISOString()
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_cfdi`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Usuarios sincronizados con Supabase');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Error sincronizando usuarios:', errorText);
      return false;
    }

  } catch (error) {
    console.error('❌ Error sincronizando usuarios:', error);
    return false;
  }
};

export const cargarUsuariosDesdeLaNube = async (password: string): Promise<Usuario[]> => {
  try {
    console.log('👥 Cargando usuarios desde Supabase...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_cfdi?id=eq.usuarios_sistema`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.length > 0 && data[0].datos_encriptados) {
        const usuariosDesencriptados = await desencriptarDatos(data[0].datos_encriptados, password);
        console.log(`☁️ ${usuariosDesencriptados.length} usuarios cargados desde Supabase`);
        return usuariosDesencriptados;
      }
    }
  } catch (error) {
    console.error('❌ Error cargando usuarios desde Supabase:', error);
  }

  return [];
};