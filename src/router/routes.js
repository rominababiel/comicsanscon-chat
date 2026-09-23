import { mountHomeView } from '../views/home.js';
import { chatViewKey, mountChatView } from '../views/chat.js';
import { mountAboutView } from '../views/about.js';

const HOME_TITLE = 'Chatea con tu personaje favorito';

export const routes = [
  { path: '/', view: mountHomeView, title: HOME_TITLE },
  { path: '/home', view: mountHomeView, title: HOME_TITLE },
  { path: '/chat', view: mountChatView, title: 'Chat', key: chatViewKey },
  { path: '/chat/:characterId', view: mountChatView, title: 'Chat', key: chatViewKey },
  { path: '/about', view: mountAboutView, title: 'Sobre el proyecto' },
];
