import { Redirect } from 'expo-router';

// Este ficheiro serve apenas para empurrar o utilizador para a página de Login mal abre a app!
export default function Index() {
  return <Redirect href="/(auth)" />;
}