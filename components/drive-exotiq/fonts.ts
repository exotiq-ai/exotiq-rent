import { Inter, Newsreader } from 'next/font/google';

export const driveInter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-drive-inter',
  display: 'swap',
});

export const driveNewsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-drive-newsreader',
  display: 'swap',
});

export const driveFontClassName = `${driveInter.variable} ${driveNewsreader.variable}`;
