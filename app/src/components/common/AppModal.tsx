import React from 'react';
import { ModalProps } from 'react-native';
import Toast from 'react-native-toast-message';
import StackedModal from './StackedModal';

export default function AppModal({ children, ...props }: ModalProps) {
  return (
    <StackedModal {...props}>
      {children}
      <Toast />
    </StackedModal>
  );
}
