/** Prefix a file in /public so it works on GitHub project Pages (/oll-athletics/). */
export function publicUrl (path: string) {
  const base = useRuntimeConfig().app.baseURL || '/'
  return `${base}${path.replace(/^\//, '')}`
}
