// Utilidades de encriptación ULTRA SEGURAS

// Función ULTRA SEGURA para manejar strings
export const safeString = (value: any): string => {
  try {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    return String(value);
  } catch (error) {
    return '';
  }
};

export const safeLowerCase = (value: any): string => {
  try {
    const str = safeString(value);
    if (!str || str.length === 0) return '';
    return str.toLowerCase();
  } catch (error) {
    return '';
  }
};

export const safeNumber = (value: any): number => {
  try {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  } catch (error) {
    return 0;
  }
};

// Función recursiva para limpiar objetos profundamente
const limpiarDatosProfundo = (obj: any): any => {
  if (obj === null || obj === undefined) return '';
  
  if (typeof obj === 'string') {
    return obj.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  }
  
  if (typeof obj === 'number') {
    return isNaN(obj) ? 0 : obj;
  }
  
  if (typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(limpiarDatosProfundo);
  }
  
  if (typeof obj === 'object') {
    const objLimpio: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        objLimpio[key] = limpiarDatosProfundo(obj[key]);
      }
    }
    return objLimpio;
  }
  
  return safeString(obj);
};

export const encriptarDatos = async (data: any, password: string): Promise<string> => {
  try {
    const datosLimpios = limpiarDatosProfundo(data);
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(datosLimpios));
    const passwordBuffer = encoder.encode(password);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      dataBuffer
    );

    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('Error encriptando datos:', error);
    throw new Error('Error en encriptación de datos');
  }
};

export const desencriptarDatos = async (encryptedData: string, password: string): Promise<any> => {
  try {
    if (!encryptedData || encryptedData.length === 0) {
      throw new Error('Datos encriptados vacíos');
    }

    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      encrypted
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error desencriptando datos:', error);
    throw new Error('Error en desencriptación - datos posiblemente corruptos');
  }
};