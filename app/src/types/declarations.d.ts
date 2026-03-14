import 'react-native';

declare module 'nativewind' {
  import { ComponentType } from 'react';
  export const TailwindProvider: ComponentType<any>;
  const _default: any;
  export default _default;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    className?: string | undefined;
  }
}

// Allow untyped modules used as placeholders
declare module 'react-native-image-picker';
declare module '@hookform/resolvers/zod';
declare module '@react-native-google-signin/google-signin';

// Allow className on core react-native components for NativeWind
declare module 'react-native' {
  interface ViewProps {
    className?: string | undefined;
  }
  interface TextProps {
    className?: string | undefined;
  }
  interface TextInputProps {
    className?: string | undefined;
  }
  interface ScrollViewProps {
    className?: string | undefined;
  }
  interface TouchableOpacityProps {
    className?: string | undefined;
  }
  interface PressableProps {
    className?: string | undefined;
  }
}
