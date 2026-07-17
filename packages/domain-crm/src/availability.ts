import type { AvailabilityInput } from '@loyala/validation';

export type Availability = AvailabilityInput;

function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Whether something (variant, supplement, or product) is available at `now`.
 * `undefined` or `available` → always on. `scheduled` restricts by weekday and
 * an optional time window (supports overnight windows, e.g. 22:00–02:00).
 */
export function isAvailableNow(availability: Availability | undefined, now: Date = new Date()): boolean {
  if (!availability || availability.status === 'available') return true;
  if (availability.status === 'unavailable') return false;

  // scheduled
  if (availability.days && availability.days.length > 0) {
    if (!availability.days.includes(now.getDay())) return false;
  }

  if (availability.timeStart && availability.timeEnd) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = minutesOfDay(availability.timeStart);
    const end = minutesOfDay(availability.timeEnd);
    if (start !== null && end !== null) {
      if (start <= end) {
        if (cur < start || cur > end) return false;
      } else {
        // overnight window (e.g. 22:00 → 02:00)
        if (cur < start && cur > end) return false;
      }
    }
  }

  return true;
}

/** Short human label for an availability config (admin UI). */
export function describeAvailability(availability: Availability | undefined): string {
  if (!availability || availability.status === 'available') return 'Disponible';
  if (availability.status === 'unavailable') return 'Indisponible';
  const parts: string[] = [];
  const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  if (availability.days && availability.days.length > 0 && availability.days.length < 7) {
    parts.push(availability.days.map((d) => dayLabels[d] ?? '').join(', '));
  }
  if (availability.timeStart && availability.timeEnd) {
    parts.push(`${availability.timeStart}–${availability.timeEnd}`);
  }
  return parts.length > 0 ? `Programmé : ${parts.join(' · ')}` : 'Programmé';
}
