import { Alert, Platform } from 'react-native';

type ConfirmActionOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/**
 * An Alert with buttons is ignored on web, so the browser prompt stands in
 * there. Anything asking "are you sure" has to go through this.
 */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
    return confirmFn ? confirmFn(options.description) : true;
  }

  return await new Promise((resolve) => {
    Alert.alert(options.title, options.description, [
      {
        text: options.cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
