window.ARM = window.ARM || {};

ARM.courts = [
  {
    id: "court-1",
    name: "Match Court",
    badge: "Covered · LED",
    description:
      "Premium covered silica sand court for competitive singles and doubles under full-court lighting.",
    surface: "Silica sand",
    lighting: "Full-court LED",
    capacity: "Up to 4 players",
    bestFor: "Competition",
    image: "/assets/courts/match.jpg",
    imageAlt: "Covered Match Court with LED lighting at dusk",
  },
  {
    id: "court-2",
    name: "Training Court",
    badge: "Covered · Practice",
    description:
      "Ideal for drills, coaching, and recreational rallies with consistent bounce and grip.",
    surface: "Silica sand",
    lighting: "Evening lights",
    capacity: "Up to 4 players",
    bestFor: "Training",
    image: "/assets/courts/training.jpg",
    imageAlt: "Covered Training Court ready for practice sessions",
  },
  {
    id: "court-3",
    name: "Group Court",
    badge: "Covered · Events",
    description:
      "Spacious setup for clinics, social matches, and group sessions, weather-protected all day.",
    surface: "Silica sand",
    lighting: "Full-court LED",
    capacity: "Up to 8 players",
    bestFor: "Groups",
    image: "/assets/courts/group.jpg",
    imageAlt: "Spacious covered Group Court under evening lights",
  },
  {
    id: "court-4",
    name: "Doubles Court",
    badge: "Covered · Doubles",
    description:
      "Built for fast doubles exchanges with clear sidelines and consistent bounce for league nights.",
    surface: "Silica sand",
    lighting: "Full-court LED",
    capacity: "Up to 4 players",
    bestFor: "Doubles",
    image: "/assets/courts/doubles.jpg",
    imageAlt: "Covered Doubles Court ready for competitive play",
  },
  {
    id: "court-5",
    name: "Social Court",
    badge: "Covered · Casual",
    description:
      "A relaxed court for open play, mixed skill sessions, and friendly matches with friends.",
    surface: "Silica sand",
    lighting: "Evening lights",
    capacity: "Up to 4 players",
    bestFor: "Social play",
    image: "/assets/courts/social.jpg",
    imageAlt: "Covered Social Court for casual pickleball",
  },
  {
    id: "court-6",
    name: "Night Court",
    badge: "Covered · Night LED",
    description:
      "Bright night-ready court for late sessions, after-work matches, and evening tournaments.",
    surface: "Silica sand",
    lighting: "Full-court LED",
    capacity: "Up to 4 players",
    bestFor: "Night matches",
    image: "/assets/courts/night.jpg",
    imageAlt: "Covered Night Court under strong LED lighting",
  },
];

ARM.rates = {
  morning: { label: "Morning", startHour: 7, endHour: 16, price: 300 },
  night: { label: "Night", startHour: 17, endHour: 6, price: 350 },
};

/** Philippine locale, timezone (PHT / UTC+8), and currency */
ARM.locale = "en-PH";
ARM.timeZone = "Asia/Manila";
ARM.currency = "PHP";

/** Demo open hours: 07:00–23:00 Philippine Time in 1-hour slots */
ARM.slotHours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

ARM.formatPrice = (n) =>
  new Intl.NumberFormat(ARM.locale, {
    style: "currency",
    currency: ARM.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n));

/** Current calendar/time parts in Asia/Manila */
ARM.manilaNow = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ARM.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

ARM.todayISO = () => {
  const { year, month, day } = ARM.manilaNow();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

ARM.formatHour = (hour) => {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
};

ARM.slotLabel = (hour) => `${ARM.formatHour(hour)} – ${ARM.formatHour(hour + 1)}`;

ARM.priceForHour = (hour) => (hour >= 7 && hour < 17 ? ARM.rates.morning.price : ARM.rates.night.price);

ARM.storageKey = "arm-pickleball-bookings-v1";
ARM.lastBookingKey = "arm-pickleball-last-booking";
ARM.pendingPayKey = "arm-pickleball-pending-pay";
ARM.preferredCourtKey = "arm-preferred-court";
