import { departContactPage, revealContactPage } from './contact-passage.js';
import { submitContact } from './contact-send.js';

revealContactPage();

const form = document.querySelector('[data-plain-form]');
const error = document.querySelector('[data-plain-error]');
if (!form || !error) {
  // The plain page has no form to submit.
} else {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    error.textContent = '';
    const submit = form.querySelector('button');
    if (submit) submit.disabled = true;
    submitContact(new FormData(form))
      .then((result) => {
        if (result && result.ok) {
          departContactPage();
          return;
        }
        error.textContent = 'השליחה לא הושלמה. שירות השליחה עדיין לא מחובר.';
        error.hidden = false;
        if (submit) submit.disabled = false;
      })
      .catch(() => {
        error.textContent = 'השליחה לא הושלמה. נסו שוב מאוחר יותר.';
        error.hidden = false;
        if (submit) submit.disabled = false;
      });
  });
}
