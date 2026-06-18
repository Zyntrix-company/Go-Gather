import React from 'react';
import { Modal, ModalProps } from 'react-native';
import Toast from 'react-native-toast-message';

export default function AppModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      {children}
      <Toast />
    </Modal>
  );
}
