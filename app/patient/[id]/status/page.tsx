import PatientStatusPage from '@/components/patient/PatientStatusPage';

interface PatientStatusRouteProps {
  params: { id: string };
}

export default function PatientStatusRoute({ params }: PatientStatusRouteProps) {
  return <PatientStatusPage patientId={params.id} />;
}
