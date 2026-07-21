import { Alert, Platform } from "react-native";

/**
 * react-native-web traz um Alert que nao faz nada: o metodo existe, a chamada
 * passa e a mensagem nunca aparece. No navegador e na extensao os avisos saem
 * pelo dialogo do proprio navegador, senao a confirmacao de apagar o historico
 * simplesmente nao teria como ser respondida.
 */
const isWeb = Platform.OS === "web";

export const showMessage = (title: string, message?: string) => {
  if (isWeb) {
    globalThis.alert(message ? `${title}\n\n${message}` : title);
    return;
  }

  Alert.alert(title, message);
};

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export const confirmDestructive = ({ title, message, confirmLabel, onConfirm }: Confirmation) => {
  if (isWeb) {
    if (globalThis.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }

    return;
  }

  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm }
  ]);
};
