import { activarFallbackPortadas } from '../../../components/cover.js';
import { eventCardSkeleton } from '../../../components/event-card.js';
import { html } from '../../../utils/html.js';
import {
  activarFavoritos,
  eventCardConFavorito,
  favoritosDelUsuario,
} from '../../catalog/index.js';
import { cargarFavoritos } from '../services/tickets.service.js';
import { crearPaginaSocial } from './social-list.js';

/** "Mis favoritos": eventos marcados, con el corazón para quitarlos (cambio optimista). */
export const favoritesPage = crearPaginaSocial({
  titulo: 'Mis favoritos',
  singular: 'evento',
  plural: 'eventos',
  claseGrid: 'event-grid',
  vacio: {
    icono: 'bi-heart',
    titulo: 'Aún no tienes favoritos',
    mensaje: 'Toca el corazón de un concierto para guardarlo aquí.',
    accion: { href: '#/eventos', texto: 'Explorar conciertos' },
  },
  cargarPagina: (page, signal) => cargarFavoritos(page, signal),
  // Todo lo que llega aquí es favorito: el corazón sale encendido.
  alCargar: (eventos) => eventos.forEach((e) => favoritosDelUsuario.fijar(e.id, true)),
  itemHtml: (evento) => eventCardConFavorito(evento),
  esqueleto: () =>
    html`<div class="event-grid" aria-hidden="true">
      ${Array.from({ length: 6 }, () => eventCardSkeleton())}
    </div>`,
  activar: (raiz, callbacks) => activarFavoritos(raiz, callbacks),
  preparar: activarFallbackPortadas,
});
