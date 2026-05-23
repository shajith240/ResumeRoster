# PDF Privacy Modes

ResumeRoster keeps the real resume layout because formatting, hierarchy, and
ATS-readability are part of the feedback. The app should not rebuild resumes
into a house template.

## Modes

- `public`: show the user's profile and keep the PDF closest to original.
- `contact_hidden`: post anonymously, redact name/email/phone/address, and keep
  useful links like GitHub or portfolio URLs visible.
- `anonymous`: post anonymously and redact name, direct contact details, and
  profile or portfolio links.

## Upload Rule

The browser must not upload resume PDFs directly to Supabase Storage. The submit
form sends the PDF to `/api/resumes/submit`; that server route processes the PDF
and only stores the processed copy.

The original PDF is held in memory during the request and discarded after
processing.

## Redaction Rule

Do not draw cosmetic boxes on top of sensitive text. Use real PDF redaction so
the underlying text is removed, then save with garbage collection and sanitized
content streams.

The current implementation uses MuPDF.js. MuPDF.js is open source under
AGPL-3.0-or-later, so keep licensing in mind if the project licensing changes.

## Failure Rule

If server-side redaction or verification cannot safely complete, the upload must
fail closed and no resume row should be created.
