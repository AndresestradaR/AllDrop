import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const NOTIFICATION_EMAIL = 'trucosecomydrop@gmail.com'

interface BookingDetails {
  mentorName: string
  mentorEmail: string
  clientEmail: string
  topic: string
  slotDate: string    // YYYY-MM-DD
  slotHour: number    // 14, 15, 16, 17
  priceUsd: number
  notes?: string
}

export async function sendBookingNotification(booking: BookingDetails) {
  const hourFormatted = `${booking.slotHour}:00 - ${booking.slotHour + 1}:00`

  const { error } = await resend.emails.send({
    from: 'Estrategas IA <noreply@estrategasia.com>',
    to: [NOTIFICATION_EMAIL, 'notificaciones@estrategasia.com', booking.mentorEmail],
    subject: `Nueva Reserva de Coaching — ${booking.topic}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #14b8a6, #0d9488); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Nueva Reserva de Coaching</h1>
        </div>
        <div style="background: #1a1a1a; padding: 24px; border-radius: 0 0 12px 12px; color: #e5e5e5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; width: 140px;">Mentor:</td>
              <td style="padding: 8px 0; font-weight: 600;">${booking.mentorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Email Mentor:</td>
              <td style="padding: 8px 0;">${booking.mentorEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Cliente:</td>
              <td style="padding: 8px 0;">${booking.clientEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Tema:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #14b8a6;">${booking.topic}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Fecha:</td>
              <td style="padding: 8px 0;">${booking.slotDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Hora (Colombia):</td>
              <td style="padding: 8px 0;">${hourFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Precio:</td>
              <td style="padding: 8px 0; font-weight: 600;">$${booking.priceUsd} USD</td>
            </tr>
            ${booking.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; vertical-align: top;">Notas:</td>
              <td style="padding: 8px 0;">${booking.notes}</td>
            </tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;" />
          <p style="color: #a1a1aa; font-size: 13px; margin: 0;">
            Pago vía billetera Dropi. El cliente enviará comprobante al mentor.
          </p>
        </div>
      </div>
    `,
  })

  if (error) {
    console.error('[Coaching] Email notification error:', error)
    throw error
  }
}
