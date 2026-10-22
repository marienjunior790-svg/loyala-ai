import type { AvailabilityInput } from '@loyala/validation';

export type Availability = AvailabilityInput;

function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Heure civile dans le fuseau du restaurant. Sans fuseau, c'est l'horloge locale. */
function clockOf(now: Date, timeZone?: string): { day: number; minutes: number } {
  if (!timeZone) {
    return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  }
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value])
    );
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    return {
      day: WEEKDAYS[parts.weekday] ?? now.getDay(),
      minutes: (hour === 24 ? 0 : hour) * 60 + minute,
    };
  } catch {
    return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  }
}

/**
 * Whether something (variant, supplement, or product) is available at `now`.
 * `undefined` or `available` → always on. `scheduled` restricts by weekday and
 * an optional time window (supports overnight windows, e.g. 22:00–02:00).
 * `timeZone` est le fuseau du restaurant, le même que celui utilisé en SQL.
 */
export function isAvailableNow(
  availability: Availability | undefined,
  now: Date = new Date(),
  timeZone?: string
): boolean {
  if (!availability || availability.status === 'available') return true;
  if (availability.status === 'unavailable') return false;

  const clock = clockOf(now, timeZone);
  // scheduled
  if (availability.days && availability.days.length > 0) {
    if (!availability.days.includes(clock.day)) return false;
  }

  if (availability.timeStart && availability.timeEnd) {
    const cur = clock.minutes;
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
