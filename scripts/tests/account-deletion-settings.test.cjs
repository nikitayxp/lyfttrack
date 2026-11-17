const assert=require('node:assert/strict');
const {test}=require('node:test');
const React=require('react');
const {act,create}=require('react-test-renderer');
const createSourceLoader=require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT=true;

for(const [language, switchBeforeRetry] of [['pt',false],['en',false],['pt',true]]){
 test(switchBeforeRetry ? 'changing accounts dismisses an old deletion confirmation' : 'account cleanup failure stays visible and retryable in '+language,async t=>{
  const resources=createSourceLoader()('app/src/i18n/resources.ts').resources;
  const translations=resources[language].translation;
  const translate=(key,values={})=>{
   let value=key.split('.').reduce((item,part)=>item?.[part],translations)??key;
   for(const [name,replacement]of Object.entries(values))value=value.replace('{{'+name+'}}',replacement);
   return value;
  };
  class AccountDeletionError extends Error{constructor(reason){super('Cleanup failed');this.reason=reason;}}
  const attempts=[];const routes=[];const empty=()=>null;
  let receiveSession;
  const load=createSourceLoader({
   'react-native':{Platform:{OS:'web',select:values=>values.web??values.default},StyleSheet:{create:value=>value},ScrollView:'ScrollView',View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',Modal:'Modal',ActivityIndicator:'Spinner'},
   '@expo/vector-icons':{Ionicons:empty},'expo-router':{router:{replace:route=>routes.push(route),push(){}}},
   'react-i18next':{useTranslation:()=>({t:translate})},
   '@/constants/theme':{Colors:{dark:{}}},'@/components/common/BackButton':{BackButton:empty},
   '@/context/ToastContext':{useAppToast:()=>({showToast(){}})},
   '@/context/PreferencesContext':{usePreferences:()=>({language,setLanguage(){},countWorkingSetsOnly:false,setCountWorkingSetsOnly(){}})},
   '@/context/WorkoutContext':{useWorkoutContext:()=>({hasActiveWorkout:false})},
   '@/services/authSessionStore':{subscribeAuthSession(listener){receiveSession=listener;listener({session:{user:{id:'owner'}}});return()=>{};}},
   '@/services/supabase':{supabase:{auth:{signOut:async()=>({error:null})}}},
   '@/services/profileService':{AccountDeletionError,getProfile:async()=>({visibility:'private'}),updateProfile:async()=>{},deleteOwnAccount:async id=>{attempts.push(id);if(attempts.length===1)throw new AccountDeletionError('avatar-cleanup-failed');}},
   '@/utils/confirmAction':{confirmAction:async()=>false},'@/utils/showAlert':{showAlert(){}},
  });
  const Screen=load('app/app/(tabs)/profile/settings.tsx').default;
  let tree;await act(async()=>{tree=create(React.createElement(Screen));});
  t.after(async()=>{await act(async()=>tree.unmount());});
  const modal=()=>tree.root.findByType('Modal');
  const button=(scope,label)=>scope.findAllByType('TouchableOpacity').find(item=>item.props.accessibilityLabel===translate(label));
  await act(async()=>button(tree.root.findByType('ScrollView'),'settings.deleteAccountAction').props.onPress());
  const word=translate('settings.deleteAccountConfirmWord');
  await act(async()=>modal().findByType('TextInput').props.onChangeText(word));
  await act(async()=>button(modal(),'settings.deleteAccountAction').props.onPress());
  assert.deepEqual(attempts,['owner']);assert.equal(routes.length,0);assert.equal(modal().props.visible,true);
  const visible=modal().findAllByType('Text').map(item=>item.props.children).filter(value=>typeof value==='string');
  assert.ok(visible.includes(translate('settings.deleteAccountAvatarCleanupError')),'The localized cleanup error must be visible');
  assert.equal(typeof translations.settings.deleteAccountAvatarCleanupError,'string');
  assert.equal(modal().findByType('TextInput').props.value,word);
  const retry=button(modal(),'common.retry');assert.ok(retry);assert.equal(retry.props.disabled,false);
  if(switchBeforeRetry){
   await act(async()=>receiveSession({session:{user:{id:'other'}}}));
   assert.equal(modal().props.visible,false);
   await act(async()=>button(tree.root.findByType('ScrollView'),'settings.deleteAccountAction').props.onPress());
   assert.equal(modal().props.visible,true);
   assert.equal(modal().findByType('TextInput').props.value,'');
   assert.equal(button(modal(),'settings.deleteAccountAction').props.disabled,true);
   assert.deepEqual(attempts,['owner']);
   return;
  }
  await act(async()=>retry.props.onPress());
  assert.deepEqual(attempts,['owner','owner']);assert.deepEqual(routes,[]);assert.equal(modal().props.visible,false);
 });
}
