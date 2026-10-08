# Despliegue de autenticación y correo en cPanel

La autenticación, los códigos OTP, los pedidos y el envío de resúmenes PDF requieren PHP y MySQL en el mismo origen que el sitio. GitHub Pages no ejecuta PHP; el dominio publicado debe servir estos archivos desde cPanel (GitHub puede seguir siendo el repositorio del código).

## Requisitos

- PHP 8.1 o posterior con `PDO MySQL`, `mbstring`, `OpenSSL` y sesiones.
- MySQL/MariaDB con permisos para crear tablas.
- Composer disponible en cPanel Terminal.
- Dominio configurado con HTTPS.
- Cuenta Gmail del comercio con verificación en dos pasos y una contraseña de aplicación.

## Instalación en cPanel

1. Activa SSL/TLS para el dominio y publica los archivos del sitio junto con las carpetas `api/` y `assets/` en la misma raíz web.
2. En **Bases de datos MySQL**, crea una base de datos y un usuario. Asígnale permisos para crear y modificar tablas.
3. Importa `api/schema.sql` en esa base de datos desde phpMyAdmin. El esquema crea las tablas y carga el catálogo inicial.
4. En la raíz del sitio, ejecuta:

   ```sh
   composer install --no-dev --optimize-autoloader
   ```

   Debe quedar disponible `vendor/autoload.php`; no subas la carpeta `vendor/` al repositorio.
5. Copia `api/config.example.php` como `api/config.local.php`. Reemplaza los valores de MySQL y correo. El archivo real está excluido de Git y las solicitudes HTTP directas a él están bloqueadas por `api/.htaccess`.
6. Para Gmail, usa `smtp.gmail.com`, puerto `587`, TLS y una **contraseña de aplicación**; no uses la contraseña normal de Gmail. La dirección remitente debe ser la cuenta configurada para SMTP. No compartas ni publiques `config.local.php`.
7. Protege `api/config.local.php` con permisos de lectura/escritura solo para la cuenta del sitio, si cPanel permite cambiarlos. Confirma que el sitio y las llamadas a `api/index.php` usan HTTPS.
8. Registra una cuenta nueva desde la página de registro y verifica el código que llega al correo. Para darle permisos administrativos, ejecuta en phpMyAdmin, sustituyendo el correo:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@tu-dominio.com';
   ```

   Cierra sesión e inicia sesión de nuevo para recibir los permisos actualizados.

## Prueba funcional

1. Registra un cliente y confirma el código OTP de seis dígitos.
2. Cierra sesión y entra otra vez: cada inicio exige un nuevo código, válido por 10 minutos.
3. Solicita recuperación de contraseña y confirma que también use el código enviado al correo.
4. Inicia sesión, crea un pedido y envía su resumen desde el modal de confirmación o el historial.
5. Confirma que llegue el PDF adjunto y que el cliente solo pueda solicitar el resumen de sus propios pedidos.
6. Inicia sesión como administrador y prueba cambio de estado, gestión de catálogo y envío del resumen.

## Alcance y datos

- Las cuentas locales anteriores y los pedidos guardados en navegadores no se migran. Las personas deben crear una cuenta nueva; los pedidos nuevos se guardan en MySQL.
- El rol administrador se asigna directamente en la base de datos; el formulario público solo crea cuentas de cliente.
- La tienda aún no integra una pasarela de pago. El checkout registra pedidos sin cobrar; el PDF enviado es un resumen informativo, no una factura electrónica ni un comprobante de pago.
- Mantén una copia segura de la base de datos y no guardes datos de tarjetas de pago en este sitio.
