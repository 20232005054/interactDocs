interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
      {message}
    </div>
  );
}
