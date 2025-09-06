export function getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = (day + 6) % 7; // how many days since Monday
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
