import type { FormSpec } from './form-spec'

/**
 * Recipes typed by hand, so the renderer can be exercised with no agent and no
 * server.
 *
 * These are also the acceptance criteria. When the agent is wired up, "I need a
 * login form" should produce something close to LOGIN — and the interesting
 * check is what is ABSENT from it. A model that pads a login form with a phone
 * number and a full name has answered the wrong question, and that is a prompt
 * problem rather than a code one.
 *
 * Every one of these parses: `pnpm dlx tsx` them through `parseFormSpec` and
 * they come back accepted. They are typed as FormSpec rather than parsed at
 * import time deliberately — a bad sample should fail the build, not the app.
 */

export const LOGIN: FormSpec = {
  title: 'Log in',
  submitLabel: 'Log in',
  fields: [
    { name: 'email', label: 'Email', kind: 'email', required: true, placeholder: 'you@example.com' },
    { name: 'password', label: 'Password', kind: 'password', required: true },
    { name: 'rememberMe', label: 'Keep me signed in', kind: 'checkbox', required: false },
  ],
}

export const REGISTER: FormSpec = {
  title: 'Create an account',
  description: 'This is a demo. Nothing you type is sent anywhere.',
  submitLabel: 'Create account',
  fields: [
    { name: 'fullName', label: 'Full name', kind: 'text', required: true, placeholder: 'Jordan Mensah' },
    { name: 'email', label: 'Email', kind: 'email', required: true, placeholder: 'jordan@example.com' },
    {
      name: 'password',
      label: 'Password',
      kind: 'password',
      required: true,
      help: 'At least eight characters.',
    },
    { name: 'acceptTerms', label: 'I accept the terms', kind: 'checkbox', required: true },
  ],
}

/**
 * The awkward one, and the reason it is here.
 *
 * It exercises every remaining kind at once — select, number, textarea, help
 * text — plus an optional field, so "required" is visibly doing something
 * rather than being true everywhere.
 */
export const BOOKING: FormSpec = {
  title: 'Book an appointment',
  description: 'A dentist, for the sake of argument.',
  submitLabel: 'Request appointment',
  fields: [
    { name: 'name', label: 'Your name', kind: 'text', required: true },
    { name: 'email', label: 'Email', kind: 'email', required: true },
    {
      name: 'preferredDay',
      label: 'Preferred day',
      kind: 'select',
      required: true,
      options: [
        { value: 'mon', label: 'Monday' },
        { value: 'tue', label: 'Tuesday' },
        { value: 'wed', label: 'Wednesday' },
        { value: 'thu', label: 'Thursday' },
        { value: 'fri', label: 'Friday' },
      ],
    },
    {
      name: 'partySize',
      label: 'People attending',
      kind: 'number',
      required: false,
      placeholder: '1',
      help: 'Leave blank if it is just you.',
    },
    {
      name: 'reason',
      label: 'Reason for visit',
      kind: 'textarea',
      required: false,
      placeholder: 'Anything the dentist should know beforehand.',
    },
  ],
}

export const SAMPLES = [
  { id: 'login', label: 'Log in', spec: LOGIN },
  { id: 'register', label: 'Register', spec: REGISTER },
  { id: 'booking', label: 'Booking', spec: BOOKING },
] as const
