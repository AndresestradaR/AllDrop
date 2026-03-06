import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, correo, pais, comunidadActual, comunidadDestino, motivo } = body

    if (!nombre || !correo || !pais || !comunidadActual || !motivo) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #14b8a6, #0d9488); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Solicitud de Cambio de Comunidad</h1>
        </div>
        <div style="background: #1a1a1a; padding: 24px; border-radius: 0 0 12px 12px; color: #e5e5e5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; width: 200px; border-bottom: 1px solid #333;">NOMBRE:</td>
              <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #333;">${nombre}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; border-bottom: 1px solid #333;">CORREO USUARIO:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #333;">${correo}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; border-bottom: 1px solid #333;">PAIS DE OPERACION:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #333;">${pais}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; border-bottom: 1px solid #333;">COMUNIDAD ACTUAL:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #333;">${comunidadActual}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; border-bottom: 1px solid #333;">COMUNIDAD DESTINO:</td>
              <td style="padding: 10px 0; font-weight: 600; color: #14b8a6; border-bottom: 1px solid #333;">${comunidadDestino}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #a1a1aa; vertical-align: top;">MOTIVO:</td>
              <td style="padding: 10px 0;">${motivo}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
          <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
            Este correo fue enviado automaticamente desde el formulario de la comunidad EstrategasIA.
            <br/>El usuario debe estar registrado en Dropi con el correo: <strong style="color: #14b8a6;">${correo}</strong>
          </p>
        </div>
      </div>
    `

    const { error } = await resend.emails.send({
      from: 'Estrategas IA <noreply@estrategasia.com>',
      to: ['Leydi.bello@dropi.co', 'gabriela.marrero@dropi.co'],
      cc: ['notificaciones@estrategasia.com'],
      replyTo: correo,
      subject: 'ENVIO DE CORREO CAMBIO DE COMUNIDAD',
      html: emailBody,
    })

    if (error) {
      console.error('[Comunidad] Email error:', error)
      return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Comunidad] Error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
