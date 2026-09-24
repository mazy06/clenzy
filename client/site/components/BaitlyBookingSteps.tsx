import type { BookingTemplate } from '../data/baitlyBookingTemplates';
import type { BaitlyBookingMessages } from '../lib/messages/baitlyBooking';
import type { useBaitlyBookingDemo } from './useBaitlyBookingDemo';
import BaitlyBookingCheckout, {
  BookingConfirmation,
} from './BaitlyBookingCheckout';
import BaitlyBookingExtras from './BaitlyBookingExtras';
import BaitlyBookingCalendar from './BaitlyBookingCalendar';
import BaitlyBookingProperties from './BaitlyBookingProperties';

export interface StepProps {
  demo: ReturnType<typeof useBaitlyBookingDemo>;
  template: BookingTemplate;
  m: BaitlyBookingMessages;
  money: (amount: number) => string;
}

export default function BaitlyBookingSteps(props: StepProps) {
  const { demo } = props;
  if (demo.step === 4) return <BookingConfirmation {...props} />;
  if (demo.step === 3) return <BaitlyBookingCheckout {...props} />;
  if (demo.step === 2) return <BaitlyBookingExtras {...props} />;
  if (demo.step === demo.datesStep) return <BaitlyBookingCalendar {...props} />;
  return <BaitlyBookingProperties {...props} />;
}
