/** Close any open native dialogs before navigation (avoids stuck inert/backdrop). */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.beforeEach(() => {
    for (const el of document.querySelectorAll('dialog[open]')) {
      (el as HTMLDialogElement).close()
    }
  })
})
