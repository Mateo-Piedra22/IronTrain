import { Metadata } from 'next';
import HelpClient from './HelpClient';

export const metadata: Metadata = {
    title: 'Help Center | IronTrain',
    description: 'Get help with your IronTrain training transmission. Transmission protocols, scoring, and account support.',
};

export default function HelpPage() {
    return <HelpClient />;
}
