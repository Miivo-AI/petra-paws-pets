import Image from "next/image";

type BadgeVariant = "dark" | "light";

function Badge({
  icon,
  label,
  variant = "light",
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  variant?: BadgeVariant;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium shadow-sm whitespace-nowrap";
  const styles =
    variant === "dark"
      ? { backgroundColor: "#3D6464", color: "#ffffff" }
      : { backgroundColor: "#ffffff", color: "#1C3328" };

  return (
    <span className={`${base} ${className}`} style={styles}>
      <span className="flex items-center justify-center w-4 h-4">
        {icon}
      </span>
      {label}
    </span>
  );
}

// ── Icons ───────────────────────────────────────────────
const GemIcon = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1L13 5.5L7.5 14L2 5.5L7.5 1Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M2 5.5H13" stroke={color} strokeWidth="1.3"/>
    <path d="M5 5.5L7.5 1L10 5.5" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M2 6.5L7.5 2L13 6.5V13H10V9.5H5V13H2V6.5Z" stroke="#1C3328" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const PawIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <ellipse cx="4.5" cy="4" rx="1.3" ry="1.8" stroke="#1C3328" strokeWidth="1.2"/>
    <ellipse cx="10.5" cy="4" rx="1.3" ry="1.8" stroke="#1C3328" strokeWidth="1.2"/>
    <ellipse cx="2.5" cy="7.5" rx="1" ry="1.5" stroke="#1C3328" strokeWidth="1.2"/>
    <ellipse cx="12.5" cy="7.5" rx="1" ry="1.5" stroke="#1C3328" strokeWidth="1.2"/>
    <path d="M7.5 6.5C5.3 6.5 3.5 8 3.5 10C3.5 12 5 13.5 7.5 13.5C10 13.5 11.5 12 11.5 10C11.5 8 9.7 6.5 7.5 6.5Z" stroke="#1C3328" strokeWidth="1.2"/>
  </svg>
);

const StarIcon = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5L9 5.5H13.5L10 8L11.5 12L7.5 9.5L3.5 12L5 8L1.5 5.5H6L7.5 1.5Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

export default function TrustBar() {
  return (
    <section className="relative z-10 py-12 lg:py-14">
      {/* Bg image bleeds past the section's own bottom edge so its curve
          masks the top of the section below instead of cutting flat */}
      <div className="absolute inset-x-0 top-0 -z-10" style={{ height: "calc(100% + 50px)" }}>
        <Image
          src="/images/section-2-bg.png"
          alt=""
          fill
          className="object-cover object-bottom"
          sizes="100vw"
        />
      </div>
      <div className="container-petra">

        {/* Top badge row — staggered vertical positions */}
        <div className="flex items-start justify-between mb-8">
          {/* Stress-free: dark, sits slightly lower */}
          <Badge
            variant="dark"
            label="Stress-free"
            className="mt-5"
            icon={<GemIcon color="#ffffff" />}
          />
          {/* Door-to-door: light, sits higher */}
          <Badge
            variant="light"
            label="Door-to-door"
            icon={<HomeIcon />}
          />
        </div>

        {/* Main body text — large, centered, serif. Shorter copy on mobile. */}
        <p className="mx-auto max-w-3xl text-center font-serif font-bold text-petra-green text-2xl sm:text-3xl lg:text-[40px] lg:leading-[1.25] lg:hidden">
          Petra Paws Pets brings professional grooming straight to your home.
          No car rides, no waiting rooms. Just professional grooming done
          right.
        </p>
        <p className="hidden lg:block mx-auto max-w-3xl text-center font-serif font-bold text-petra-green text-3xl lg:text-[40px] lg:leading-[1.25]">
          Petra Paws Pets brings professional grooming straight to your home.
          No car rides, no waiting rooms, no unfamiliar smells. Just a calm
          pet, a trained groomer, and professional grooming done right, just
          outside your door.
        </p>

        {/* Bottom badge row — staggered vertical positions */}
        <div className="flex items-start justify-between mt-8">
          {/* All breeds welcome: light, sits slightly lower */}
          <Badge
            variant="light"
            label="All breeds welcome"
            className="mt-4"
            icon={<PawIcon />}
          />
          {/* Certified groomers: dark, sits higher */}
          <Badge
            variant="dark"
            label="Certified groomers"
            icon={<StarIcon color="#ffffff" />}
          />
        </div>

      </div>
    </section>
  );
}
