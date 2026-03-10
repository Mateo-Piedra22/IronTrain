'use client';

import {
    Activity,
    Check,
    Dumbbell,
    Search,
    ShoppingBag,
    Tag,
    Trash2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { handleMarketplaceEntityAction } from '../actions';

interface MarketplaceManagementPanelProps {
    officialExercises: any[];
    officialCategories: any[];
    officialBadges: any[];
    editingId?: string;
    editingType?: 'exercises' | 'categories' | 'badges';
}

export default function MarketplaceManagementPanel({
    officialExercises,
    officialCategories,
    officialBadges,
    editingId,
    editingType
}: MarketplaceManagementPanelProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeSection = (searchParams.get('section') as 'exercises' | 'categories' | 'badges') || 'exercises';

    const [searchQuery, setSearchQuery] = useState('');

    const setActiveSection = (section: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('section', section);
        params.delete('editId');
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const handleEdit = (id: string, type: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('editId', id);
        params.set('editType', type);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const editingItem = editingId && editingType === activeSection
        ? (activeSection === 'exercises' ? officialExercises.find(e => e.id === editingId) :
            activeSection === 'categories' ? officialCategories.find(c => c.id === editingId) :
                officialBadges.find(b => b.id === editingId))
        : null;

    const filteredItems = (activeSection === 'exercises' ? officialExercises :
        activeSection === 'categories' ? officialCategories :
            officialBadges).filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );

    return (
        <div className="space-y-12">
            {/* Context Navigation */}
            <div className="flex border-b border-[#1a1a2e]/10">
                <button
                    onClick={() => setActiveSection('exercises')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'exercises' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    <div className="flex items-center gap-2 italic">
                        <Dumbbell className="w-4 h-4" />
                        EJERCICIOS_OFICIALES
                    </div>
                </button>
                <button
                    onClick={() => setActiveSection('categories')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'categories' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        CATEGORIAS_MASTER
                    </div>
                </button>
                <button
                    onClick={() => setActiveSection('badges')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'badges' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        MEDALLAS_Y_TAGS
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Column */}
                <div className="border-4 border-[#1a1a2e] p-6 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,1)] lg:sticky lg:top-8 h-fit">
                    <div className="flex items-center gap-3 mb-6 border-b-2 border-[#1a1a2e] pb-2">
                        <ShoppingBag className="w-5 h-5" />
                        <h3 className="font-black text-sm uppercase">
                            {editingItem ? `EDIT_${activeSection.slice(0, -1).toUpperCase()}` : `NEW_OFFICIAL_${activeSection.slice(0, -1).toUpperCase()}`}
                        </h3>
                    </div>

                    <form action={handleMarketplaceEntityAction} className="space-y-5">
                        <input type="hidden" name="table" value={activeSection} />
                        <input type="hidden" name="id" value={editingItem?.id || ''} />
                        <input type="hidden" name="origin_tab" value="marketplace" />
                        <input type="hidden" name="origin_section" value={activeSection} />

                        <div>
                            <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Nombre</label>
                            <input name="name" defaultValue={editingItem?.name} placeholder="Nombre del item..." className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none focus:bg-white transition-colors" required />
                        </div>

                        {activeSection === 'exercises' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Tipo</label>
                                    <select name="type" defaultValue={editingItem?.type || 'weight_reps'} className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none">
                                        <option value="weight_reps">Peso y Reps</option>
                                        <option value="reps_only">Solo Reps</option>
                                        <option value="distance_time">Distancia y Tiempo</option>
                                        <option value="time_only">Solo Tiempo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Categoría</label>
                                    <select name="categoryId" defaultValue={editingItem?.categoryId} className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none" required>
                                        <option value="">Seleccionar Categoría...</option>
                                        {officialCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Notas / Guía Técnica</label>
                                    <textarea name="notes" defaultValue={editingItem?.notes} rows={4} placeholder="Descripción técnica del ejercicio..." className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none focus:bg-white" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Incremento Sugerido (kg)</label>
                                    <input name="defaultIncrement" type="number" step="0.5" defaultValue={editingItem?.defaultIncrement || 2.5} className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Badges / Músculos</label>
                                    <div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto border-2 border-[#1a1a2e] p-2 bg-[#f8f6f0]">
                                        {officialBadges.map(b => (
                                            <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" name="badgeIds" value={b.id} defaultChecked={editingItem?.badges?.some((eb: any) => eb.badgeId === b.id)} className="w-4 h-4 accent-[#1a1a2e]" />
                                                <span className="text-[9px] font-bold uppercase truncate">{b.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === 'categories' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Color (Hex)</label>
                                    <input name="color" defaultValue={editingItem?.color || '#1a1a2e'} type="color" className="w-full h-12 bg-white border-2 border-[#1a1a2e] p-1 cursor-pointer" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Prioridad Visual (Sort Order)</label>
                                    <input name="sortOrder" type="number" defaultValue={editingItem?.sortOrder || 0} className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none" />
                                </div>
                            </>
                        )}

                        {activeSection === 'badges' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Color (Hex)</label>
                                        <input name="color" defaultValue={editingItem?.color || '#1a1a2e'} type="color" className="w-full h-12 bg-white border-2 border-[#1a1a2e] p-1 cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Icono (Name)</label>
                                        <input name="icon" defaultValue={editingItem?.icon} placeholder="muscle, fire, etc." className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-1">Grupo (Tag Group)</label>
                                    <input name="groupName" defaultValue={editingItem?.groupName || 'Primary'} placeholder="Muscle, Equipment, Intensity..." className="w-full bg-[#f8f6f0] border-2 border-[#1a1a2e] p-3 text-xs font-bold focus:outline-none" />
                                </div>
                            </>
                        )}

                        <button type="submit" name="intent" value="save" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-red-600 transition-all shadow-[6px_6px_0px_0px_rgba(26,26,46,0.2)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 mt-4">
                            {editingItem ? 'COMMIT_CHANGES' : 'PUBLISH_OFFICIAL'}
                            <Check className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                {/* List Column */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                        <input
                            type="text"
                            placeholder={`Buscar en ${activeSection.toUpperCase()}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border-2 border-[#1a1a2e] py-4 pl-12 pr-4 text-xs font-black uppercase focus:outline-none focus:ring-4 focus:ring-[#1a1a2e]/5"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredItems.map((item) => (
                            <div key={item.id} className="group border-2 border-[#1a1a2e] bg-white p-5 flex flex-col justify-between hover:shadow-[10px_10px_0px_0px_rgba(26,26,46,0.05)] transition-all relative overflow-hidden">
                                {item.color && (
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: item.color }} />
                                )}
                                <div>
                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <h4 className="font-black text-sm uppercase leading-tight pr-4">{item.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(item.id, activeSection)}
                                                className="text-[10px] font-black uppercase opacity-40 hover:opacity-100 hover:underline"
                                            >
                                                EDIT
                                            </button>
                                            <form action={handleMarketplaceEntityAction}>
                                                <input type="hidden" name="table" value={activeSection} />
                                                <input type="hidden" name="id" value={item.id} />
                                                <input type="hidden" name="origin_tab" value="marketplace" />
                                                <input type="hidden" name="origin_section" value={activeSection} />
                                                <button type="submit" name="intent" value="delete" className="text-red-500/40 hover:text-red-600 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>

                                    <div className="pl-2 space-y-2">
                                        {activeSection === 'exercises' && (
                                            <>
                                                <div className="text-[9px] font-bold opacity-40 uppercase flex gap-2">
                                                    <span>CAT: {officialCategories.find(c => c.id === item.categoryId)?.name || 'N/A'}</span>
                                                    <span>|</span>
                                                    <span>TYPE: {item.type}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.badges?.map((eb: any) => {
                                                        const badge = officialBadges.find(b => b.id === eb.badgeId);
                                                        if (!badge) return null;
                                                        return (
                                                            <span key={badge.id} className="text-[8px] font-black uppercase px-2 py-0.5 border border-[#1a1a2e]/10 bg-[#f8f6f0]">
                                                                {badge.name}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                        {activeSection === 'categories' && (
                                            <div className="text-[9px] font-bold opacity-40 uppercase">
                                                SORT: {item.sortOrder} | COLOR: {item.color}
                                            </div>
                                        )}
                                        {activeSection === 'badges' && (
                                            <div className="text-[9px] font-bold opacity-40 uppercase">
                                                GROUP: {item.groupName} | ICON: {item.icon || 'none'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[#1a1a2e]/10 flex justify-between items-center pl-2">
                                    <span className="text-[8px] font-mono opacity-30 text-xs">ID: {item.id.slice(0, 8)}...</span>
                                    <div className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-tighter">
                                        OFFICIAL_CATALOG
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredItems.length === 0 && (
                            <div className="col-span-full border-2 border-[#1a1a2e] border-dashed p-12 text-center opacity-40 italic">
                                No se encontraron items en esta sección.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
