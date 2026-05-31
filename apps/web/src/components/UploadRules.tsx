'use client';

import styles from './UploadRules.module.css';

/**
 * Static content panel rendered on the upload page beneath the image
 * preview / dropzone. The rules mirror the moderation policy in
 * docs/PRODUCT.md (or the canonical product copy maintained by the
 * product team) and are presented as a numbered ordered list so
 * moderators and uploaders can refer to them by number when discussing
 * rejections.
 *
 * Per the project's Techdox protocol this component intentionally:
 *   - uses no emojis,
 *   - keeps prose in full sentences,
 *   - uses sub-lists only where the source policy itself enumerates
 *     concrete examples (rules 5 and 6).
 */
interface Rule {
  /** Short label used as the visual heading for the rule. */
  title: string;
  /** Body copy. Each entry renders as its own paragraph inside the rule. */
  body: string[];
  /** Optional bulleted examples drawn from the source policy. */
  examples?: string[];
}

const RULES: Rule[] = [
  {
    title: 'Aviation-related photos only',
    body: [
      'Only upload photos that are clearly related to aviation. Examples include aircraft, helicopters, airports, airfields, aviation events, aviation equipment, and other aviation-related subjects.',
      'Photos that are not aviation-related will be rejected.',
    ],
  },
  {
    title: 'Upload only your own photos',
    body: [
      'You may only upload photos that you personally took or that you fully own the rights to.',
      'Do not upload photos copied from other websites, social media, photographers, aviation databases, or any other source without permission.',
    ],
  },
  {
    title: 'Do not upload duplicate photos',
    body: [
      'Do not upload photos that already exist in the Spotter Space database.',
      'This includes the same photo, a nearly identical version of the same photo, or a photo that has only been slightly cropped, resized, or edited.',
    ],
  },
  {
    title: 'Avoid photo spam',
    body: [
      'Do not upload many photos of the same aircraft from the same angle or with only minor differences.',
      'We encourage users to upload unique photos with meaningful variety, such as different angles, locations, moments, aircraft positions, or details.',
    ],
  },
  {
    title: 'Required information must be provided',
    body: ['Each photo must include accurate and complete information where relevant, such as:'],
    examples: [
      'Aircraft registration',
      'Aircraft type or model',
      'Airline or operator',
      'Location or airport',
      'Date of photo',
      'Other relevant aviation details',
    ],
  },
  {
    title: 'Photo quality requirements',
    body: [
      'Photos should be clear, sharp, and suitable for public display. Photos may be rejected if they are:',
    ],
    examples: [
      'Very blurry',
      'Too dark or too bright',
      'Heavily pixelated',
      'Poorly cropped',
      'Too noisy or grainy',
      'Over-edited',
      'Taken from too far away',
      'Too low in resolution',
    ],
  },
  {
    title: 'Full-resolution uploads only',
    body: [
      'Please upload photos in the highest available resolution.',
      'Do not upload screenshots, compressed copies, very small images, or low-quality versions of your original photo.',
    ],
  },
  {
    title: 'No personal watermarks',
    body: [
      'Photos with personal watermarks, logos, signatures, promotional text, or social media handles may be rejected.',
      'Spotter Space may apply its own display protection or attribution system where needed.',
    ],
  },
  {
    title: 'Backlit photos',
    body: [
      'Backlit photos are allowed only if the subject has been properly corrected during editing and the final photo is clear and visually acceptable.',
      'If the aircraft remains too dark, lacks detail, or cannot be clearly seen, the photo may be rejected.',
    ],
  },
  {
    title: 'No visible faces',
    body: [
      'Do not upload photos where people\u2019s faces are clearly visible. Photos may be rejected if they include identifiable passengers, airport staff, crew, spotters, security personnel, or other individuals.',
      'This rule helps protect privacy and avoid legal issues.',
    ],
  },
  {
    title: 'Aircraft must be close and clear enough',
    body: [
      'The aircraft or aviation subject must be clearly visible and reasonably close in the frame. Photos where the aircraft is too far away, too small, or difficult to identify may be rejected.',
    ],
  },
  {
    title: 'No basic airport photos',
    body: [
      'Do not upload general airport photos that do not have a clear aviation value. For example, basic photos of terminals, fences, parking lots, signs, gates, or airport buildings may be rejected unless they show something aviation-related, unique, historic, or clearly useful to the community.',
    ],
  },
  {
    title: 'Moderation decision',
    body: [
      'Spotter Space moderators may reject or remove photos that do not meet these rules.',
      'Repeated violations may result in upload limits, temporary restrictions, or account suspension.',
    ],
  },
];

export function UploadRules() {
  return (
    <section className={styles.rules} aria-labelledby="upload-rules-heading">
      <h2 id="upload-rules-heading" className={styles.title}>
        Photo Upload Rules
      </h2>
      <p className={styles.intro}>
        To keep Spotter Space useful, high-quality, and respectful, all uploaded photos must follow
        the rules below. Photos that do not meet these requirements may be rejected or removed.
      </p>
      <ol className={styles.list}>
        {RULES.map((rule) => (
          <li key={rule.title} className={styles.item}>
            <h3 className={styles.itemTitle}>{rule.title}</h3>
            {rule.body.map((paragraph) => (
              <p key={paragraph} className={styles.itemBody}>
                {paragraph}
              </p>
            ))}
            {rule.examples && rule.examples.length > 0 && (
              <ul className={styles.examples}>
                {rule.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
