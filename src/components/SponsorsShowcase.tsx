import React, { useState } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Phone, 
  ExternalLink, 
  Compass, 
  Star, 
  Navigation,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Layers
} from 'lucide-react';
import { SponsorItem } from '../data/sponsors';
import { useUserLocation, calculateDistanceKm } from '../context/LocationContext';

interface SponsorsShowcaseProps {
  sponsors: SponsorItem[];
  userCity?: string;
  onOpenRegisterSponsor?: () => void;
}

export const SponsorsShowcase: React.FC<SponsorsShowcaseProps> = ({
  sponsors,
  userCity = '',
  onOpenRegisterSponsor
}) => {
  // Coordenadas exatas obtidas automaticamente e silenciosamente em tempo real
  const { coords, userCoords, status, requestLocation } = useUserLocation();

  // Filtrar patrocinadores ativos e liberados pela moderação
  const activeSponsors = sponsors.filter(s => s.active && s.liberado !== 'N' && s.liberado !== 'pendente');

  // Ordenar puramente por proximidade (distância até as coordenadas do solicitante) e limitar em exatamente 5 patrocinadores
  const sortedSponsors = [...activeSponsors].map(sponsor => {
    let distance: number | undefined = undefined;
    const ref = coords || userCoords;
    if (ref) {
      distance = calculateDistanceKm(ref.latitude, ref.longitude, sponsor.latitude, sponsor.longitude);
    }
    return {
      ...sponsor,
      distanceKm: distance
    };
  }).sort((a, b) => {
    const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999999;
    const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999999;
    if (distA !== distB) {
      return distA - distB;
    }
    return (a.city || '').localeCompare(b.city || '');
  }).slice(0, 5);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-amber-500/20">
      {/* Header com selo e explicação de valor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 mb-2 shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>OS 5 PATROCINADORES MAIS PRÓXIMOS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>⭐ Parceiros Recomendados na Sua Região</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Adegas, restaurantes, salões, lanches e conveniências mais perto de você.
          </p>
        </div>

        {/* Indicador silencioso e automático de GPS */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 shadow-sm transition-all cursor-pointer active:scale-95"
            title={status === 'granted' && coords ? `Latitude: ${coords.latitude.toFixed(4)}, Longitude: ${coords.longitude.toFixed(4)}. Clique para atualizar.` : 'Utilizando coordenadas de São Paulo - SP. Clique para ativar GPS real.'}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {status === 'granted' && coords
                ? `GPS: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                : 'Ativar GPS Real ⚡'}
            </span>
          </button>
        </div>
      </div>

      {/* Grid com os Patrocinadores Mais Próximos */}
      {sortedSponsors.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800">
          <p className="text-sm font-semibold text-slate-400">Nenhum parceiro encontrado no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedSponsors.map((sponsor, idx) => (
          <div
            key={sponsor.id}
            className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950 border border-amber-500/25 hover:border-amber-400 rounded-2xl p-4 shadow-lg hover:shadow-amber-500/10 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Tag Top Proximidade */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Compass className="w-3 h-3 text-amber-400" />
                {sponsor.distanceKm ? `A aprox. ${sponsor.distanceKm} km` : `${sponsor.city} - ${sponsor.state}`}
              </span>
              {sponsor.badge && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {sponsor.badge}
                </span>
              )}
            </div>

            {/* Foto e Informações Principais */}
            <div className="flex gap-3.5 mb-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative border border-slate-700 bg-slate-800">
                <img
                  src={sponsor.imageUrl}
                  alt={sponsor.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase block truncate">
                  {sponsor.category}
                </span>
                <h3 className="font-extrabold text-white text-sm leading-tight group-hover:text-amber-300 transition-colors line-clamp-2">
                  {sponsor.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-snug">
                  {sponsor.description}
                </p>
              </div>
            </div>

            {/* Endereço resumido */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3.5 pb-2 border-b border-slate-800">
              <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">{sponsor.address}</span>
            </div>

            {/* Botões de Contato e Ação Imediata */}
            <div className="grid grid-cols-2 gap-2 mt-auto">
              <a
                href={`https://wa.me/55${sponsor.phone.replace(/\D/g, '')}?text=Ol%C3%A1!%20Vi%20voc%C3%AAs%20no%20app%20Pra%20Onde%20Eu%20Vou!`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 fill-slate-950" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sponsor.name + ' ' + sponsor.address + ' ' + sponsor.city)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Como Chegar</span>
              </a>
            </div>
          </div>
        ))}

        {/* Card Convite para Novos Patrocinadores (R$ 100/mês) */}
        <div className="relative bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-slate-900/90 border-2 border-dashed border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between text-center group hover:border-amber-400 transition-all">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest block mb-1">
              Seja um Patrocinador
            </span>
            <h3 className="text-base font-black text-white mb-2">
              Divulgue seu Comércio Aqui
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Apareça com destaque para quem está saindo para se divertir na sua cidade. Plano exclusivo por apenas <strong className="text-amber-300">R$ 100,00/mês</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRegisterSponsor}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition-all transform group-hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Quero Anunciar por R$ 100</span>
          </button>
        </div>
      </div>
      )}
    </section>
  );
};
