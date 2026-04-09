export const ADMIN_EMAILS = ['infoalldrop@gmail.com', 'danibg8000@gmail.com']

export const isAdmin = (email: string | null | undefined): boolean =>
  !!email && ADMIN_EMAILS.includes(email)
