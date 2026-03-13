import React from 'react';
import BlobBackground from './BlobBackground';

type Props = { children: React.ReactNode };

export default function ScreenContainer({ children }: Props) {
  return (
    <BlobBackground>
      {children}
    </BlobBackground>
  );
}
