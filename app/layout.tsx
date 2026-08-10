import type { Metadata } from "next";
import { Geist, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import BookingModal from "@/components/public/BookingModal";
import Toaster from "@/components/Toaster";
import GlobalErrorToaster from "@/components/GlobalErrorToaster";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Petra Paws | Mobile Pet Grooming — Dubai",
  description:
    "Professional mobile dog & cat grooming that comes to your door. Serving Nad Al Sheba, Meydan, Business Bay and more. Book online, pay securely, relax.",
  keywords: [
    "pet grooming dubai",
    "mobile dog grooming",
    "cat grooming dubai",
    "dog grooming home service",
    "Nad Al Sheba pet grooming",
    "Meydan dog grooming",
  ],
  openGraph: {
    title: "Petra Paws | Mobile Pet Grooming Dubai",
    description: "Professional grooming that comes to your door.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${geist.variable} ${playfair.variable} ${jakarta.variable}`}
    >
      <body className="font-sans">
        {children}
        <BookingModal />
        <Toaster />
        <GlobalErrorToaster />
      </body>
    </html>
  );
}
