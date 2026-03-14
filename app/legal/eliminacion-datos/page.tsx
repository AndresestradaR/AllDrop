export const metadata = {
  title: 'Eliminación de Datos | EstrategasIA',
}

export default function EliminacionDatosPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Eliminación de Datos de Usuario</h1>
        <p className="text-gray-500 text-sm mb-8">Última actualización: 14 de marzo de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">Cómo solicitar la eliminación de tus datos</h2>
            <p>
              En EstrategasIA respetamos tu derecho a la privacidad. Puedes solicitar la eliminación completa de tus datos personales en cualquier momento siguiendo estos pasos:
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Opción 1: Desde la plataforma</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>Inicia sesión en <a href="https://www.estrategasia.com" className="text-blue-600 hover:underline">estrategasia.com</a>.</li>
              <li>Ve a <strong>Settings</strong> en el menú lateral.</li>
              <li>Elimina todas tus claves API almacenadas (Meta token, Anthropic, etc.).</li>
              <li>Esto revocará inmediatamente el acceso a tus cuentas de terceros.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Opción 2: Solicitud por correo</h2>
            <p>
              Envía un correo a{' '}
              <a href="mailto:soporteritualdebelleza@gmail.com" className="text-blue-600 hover:underline">
                soporteritualdebelleza@gmail.com
              </a>{' '}
              con el asunto <strong>&quot;Solicitud de eliminación de datos&quot;</strong> incluyendo:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Tu correo electrónico de registro.</li>
              <li>Confirmación de que deseas eliminar todos tus datos.</li>
            </ul>
            <p className="mt-2">
              Procesaremos tu solicitud en un plazo máximo de <strong>30 días</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Datos que se eliminan</h2>
            <p>Al procesar tu solicitud, eliminamos permanentemente:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Tu cuenta de usuario y perfil.</li>
              <li>Todas las claves API almacenadas (cifradas).</li>
              <li>Historial de conversaciones de Meta Ads IA.</li>
              <li>Acciones pendientes y ejecutadas.</li>
              <li>Productos, landing pages y contenido generado.</li>
              <li>Imágenes y videos almacenados en nuestros servidores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Datos que NO podemos eliminar</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Campañas o anuncios creados en tu cuenta de Meta Ads (debes gestionarlos directamente en Meta).</li>
              <li>Archivos almacenados en tu propio Cloudflare R2 (son tuyos, los gestionas tú).</li>
              <li>Datos procesados por terceros (Anthropic, Google, OpenAI) según sus propias políticas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Revocar acceso de Meta</h2>
            <p>
              Además de eliminar datos en nuestra plataforma, puedes revocar el acceso de nuestra app desde Facebook:
            </p>
            <ol className="list-decimal ml-6 mt-2 space-y-2">
              <li>Ve a <strong>Facebook → Configuración → Seguridad e inicio de sesión → Apps y sitios web</strong>.</li>
              <li>Busca <strong>Manejoestrategasia</strong> y haz clic en <strong>Eliminar</strong>.</li>
              <li>Esto revocará inmediatamente todos los permisos de acceso.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contacto</h2>
            <p>
              Si tienes preguntas sobre la eliminación de datos:{' '}
              <a href="mailto:soporteritualdebelleza@gmail.com" className="text-blue-600 hover:underline">
                soporteritualdebelleza@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
