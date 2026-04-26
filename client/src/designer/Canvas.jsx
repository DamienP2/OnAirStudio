import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import Moveable from 'react-moveable';
import { TemplateObjectContent } from '../template-objects';
import { ratioOf } from './defaultProps';
import { newObjectOfType, defaultsForType } from './Palette';
import { useTimerState } from '../store/TimerContext';

function aspectRatioLabel(w, h) {
  const r = w / h;
  const RATIOS = [
    [21 / 9, '21:9'], [16 / 9, '16:9'], [4 / 3, '4:3'],
    [1, '1:1'], [9 / 16, '9:16'], [3 / 4, '3:4']
  ];
  for (const [val, lbl] of RATIOS) {
    if (Math.abs(r - val) < 0.01) return lbl;
  }
  return `${w}:${h}`;
}

function Rulers({ canvasW, canvasH, zoom, containerRect, canvasOffsetX, canvasOffsetY, onStartGuide }) {
  if (!containerRect) return null;
  const step = zoom < 0.25 ? 200 : zoom < 0.5 ? 100 : zoom < 1 ? 50 : 20;

  // Generate tick marks with numbers for the horizontal ruler
  const hTicks = [];
  const maxH = canvasW;
  for (let px = 0; px <= maxH; px += step) {
    hTicks.push(px);
  }

  // Generate tick marks with numbers for the vertical ruler
  const vTicks = [];
  const maxV = canvasH;
  for (let px = 0; px <= maxV; px += step) {
    vTicks.push(px);
  }

  return (
    <>
      {/* Ruler horizontal — top, offset 24px left for corner */}
      <div
        className="absolute top-0 left-6 right-0 h-6 bg-slate-900/90 border-b border-white/10 overflow-hidden font-mono text-[9px] text-slate-500"
        style={{ zIndex: 20, cursor: 's-resize' }}
        onMouseDown={e => onStartGuide && onStartGuide('h', e)}
      >
        {hTicks.map(px => {
          const xPos = canvasOffsetX + px * zoom;
          if (xPos < 0 || xPos > containerRect.width - 24) return null;
          const isMajor = px % (step * 5) === 0;
          return (
            <div
              key={px}
              className="absolute bottom-0 flex flex-col items-center pointer-events-none"
              style={{ left: xPos }}
            >
              <div
                className="bg-white/20"
                style={{ width: 1, height: isMajor ? 10 : 5 }}
              />
              {isMajor && px > 0 && (
                <span
                  className="absolute bottom-2 text-[8px] text-slate-500 select-none"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  {px}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Ruler vertical — left, offset 24px top for corner */}
      <div
        className="absolute top-6 left-0 bottom-0 w-6 bg-slate-900/90 border-r border-white/10 overflow-hidden font-mono text-[9px] text-slate-500"
        style={{ zIndex: 20, cursor: 'e-resize' }}
        onMouseDown={e => onStartGuide && onStartGuide('v', e)}
      >
        {vTicks.map(px => {
          const yPos = canvasOffsetY + px * zoom;
          if (yPos < 0 || yPos > containerRect.height - 24) return null;
          const isMajor = px % (step * 5) === 0;
          return (
            <div
              key={px}
              className="absolute right-0 flex items-center pointer-events-none"
              style={{ top: yPos }}
            >
              <div
                className="bg-white/20"
                style={{ width: isMajor ? 10 : 5, height: 1 }}
              />
              {isMajor && px > 0 && (
                <span
                  className="absolute right-2 text-[8px] text-slate-500 select-none"
                  style={{ transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center center' }}
                >
                  {px}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Corner square */}
      <div
        className="absolute top-0 left-0 w-6 h-6 bg-slate-900/90 border-b border-r border-white/10 pointer-events-none"
        style={{ zIndex: 21 }}
      />
    </>
  );
}

export default function Canvas({ template, selectedIds, onSelect, onUpdate, onUpdateCanvas, onAdd }) {
  const { timezone: appTz } = useTimerState();
  const wrapRef = useRef();
  const containerRef = useRef();
  const moveableRef = useRef();
  const [zoom, setZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);
  const [containerRect, setContainerRect] = useState(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Guide drag state
  const [pendingGuide, setPendingGuide] = useState(null); // { orientation: 'h'|'v', position: number } during drag

  // HUD pendant drag/resize : affiche juste { x, y, w, h } de l'objet en cours.
  // Plus clair que la grappe de chiffres natifs de Moveable.
  const [hudInfo, setHudInfo] = useState(null); // { x, y, w, h, rotation } | null

  // Canvas grid / guides / snap fallbacks (rétro-compat)
  const gridEnabled = template.canvas.gridEnabled !== false;
  const gridSize = template.canvas.gridSize || 50;
  const gridColor = template.canvas.gridColor || '#FFFFFF';
  const gridOpacity = template.canvas.gridOpacity !== undefined ? template.canvas.gridOpacity : 0.08;
  const snapEnabled = template.canvas.snapEnabled !== false;
  const guides = template.canvas.guides || [];

  // Repères système — calculés à partir des dimensions du canvas.
  // showMargins : 4 lignes formant un cadre à 25 px de l'intérieur des bords.
  // showMidGuides : lignes verticales et horizontales aux 1/4, 1/2, 3/4 du canvas.
  // Non déplaçables, non supprimables, couleur ambre pour les distinguer.
  const SYSTEM_MARGIN_PX = 25;
  const showMargins = !!template.canvas.showMargins;
  const showMidGuides = !!template.canvas.showMidGuides;
  const cw = template.canvas.width;
  const ch = template.canvas.height;
  const systemGuides = [];
  if (showMargins) {
    systemGuides.push(
      { kind: 'margin', orientation: 'v', position: SYSTEM_MARGIN_PX },
      { kind: 'margin', orientation: 'v', position: cw - SYSTEM_MARGIN_PX },
      { kind: 'margin', orientation: 'h', position: SYSTEM_MARGIN_PX },
      { kind: 'margin', orientation: 'h', position: ch - SYSTEM_MARGIN_PX }
    );
  }
  if (showMidGuides) {
    systemGuides.push(
      { kind: 'mid', orientation: 'v', position: Math.round(cw * 0.25) },
      { kind: 'mid', orientation: 'v', position: Math.round(cw * 0.50) },
      { kind: 'mid', orientation: 'v', position: Math.round(cw * 0.75) },
      { kind: 'mid', orientation: 'h', position: Math.round(ch * 0.25) },
      { kind: 'mid', orientation: 'h', position: Math.round(ch * 0.50) },
      { kind: 'mid', orientation: 'h', position: Math.round(ch * 0.75) }
    );
  }

  // Quand les objets sélectionnés changent de position/taille via l'Inspector (hors drag),
  // on force Moveable à re-synchroniser ses handles avec la cible DOM.
  React.useEffect(() => {
    if (moveableRef.current && selectedIds.length > 0) {
      // Petit délai pour que React ait appliqué le style au DOM
      const t = requestAnimationFrame(() => {
        try { moveableRef.current.updateTarget(); } catch {}
      });
      return () => cancelAnimationFrame(t);
    }
  }, [template.objects, selectedIds]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerRect(rect);

      if (autoFit) {
        // 80px margin, plus account for 24px rulers on top and left
        const availW = rect.width - 24 - 80;
        const availH = rect.height - 24 - 80;
        const fit = Math.min(
          availW / template.canvas.width,
          availH / template.canvas.height
        );
        setZoom(Math.max(0.05, Math.min(2, fit)));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [autoFit, template.canvas.width, template.canvas.height]);

  // After zoom/container changes, measure canvas offset for rulers
  useLayoutEffect(() => {
    if (!wrapRef.current || !containerRef.current) return;
    const updateOffset = () => {
      const containerR = containerRef.current.getBoundingClientRect();
      const wrapR = wrapRef.current.getBoundingClientRect();
      setCanvasOffset({
        x: wrapR.left - containerR.left - 24, // subtract ruler width
        y: wrapR.top - containerR.top - 24    // subtract ruler height
      });
    };
    updateOffset();
    // Small delay to let flexbox settle
    const t = setTimeout(updateOffset, 50);
    return () => clearTimeout(t);
  }, [zoom, containerRect]);

  const adjustZoom = (delta) => {
    setAutoFit(false);
    setZoom(z => Math.max(0.05, Math.min(4, z + delta)));
  };
  const zoomTo100 = () => { setAutoFit(false); setZoom(1); };
  const zoomFit = () => { setAutoFit(true); };

  // ── Guide management ─────────────────────────────────────────────────────

  const updateGuides = useCallback((newGuides) => {
    if (onUpdateCanvas) {
      onUpdateCanvas({ guides: newGuides });
    }
  }, [onUpdateCanvas]);

  const removeGuide = useCallback((id) => {
    updateGuides(guides.filter(g => g.id !== id));
  }, [guides, updateGuides]);

  // Drag an existing guide
  const startMoveGuide = useCallback((e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const guide = guides.find(g => g.id === id);
    if (!guide) return;

    const wrapR = wrapRef.current.getBoundingClientRect();

    // Helper : snap au multiple de gridSize si snap activé
    const snapPos = (p) => (snapEnabled && gridSize > 0) ? Math.round(p / gridSize) * gridSize : p;

    const onMove = (ev) => {
      let pos;
      if (guide.orientation === 'h') {
        pos = Math.round((ev.clientY - wrapR.top) / zoom);
      } else {
        pos = Math.round((ev.clientX - wrapR.left) / zoom);
      }
      pos = snapPos(pos);
      setPendingGuide({ id, orientation: guide.orientation, position: pos });
    };

    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';

      let pos;
      if (guide.orientation === 'h') {
        pos = Math.round((ev.clientY - wrapR.top) / zoom);
      } else {
        pos = Math.round((ev.clientX - wrapR.left) / zoom);
      }
      pos = snapPos(pos);

      const maxW = template.canvas.width;
      const maxH = template.canvas.height;
      const inRange = guide.orientation === 'h'
        ? pos >= 0 && pos <= maxH
        : pos >= 0 && pos <= maxW;

      if (!inRange) {
        updateGuides(guides.filter(g => g.id !== id));
      } else {
        updateGuides(guides.map(g => g.id === id ? { ...g, position: pos } : g));
      }
      setPendingGuide(null);
    };

    document.body.style.cursor = guide.orientation === 'h' ? 'ns-resize' : 'ew-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [guides, zoom, template.canvas.width, template.canvas.height, updateGuides, snapEnabled, gridSize]);

  // Drag from ruler to create a new guide
  const handleRulerMouseDown = useCallback((orientation, e) => {
    e.preventDefault();
    if (!wrapRef.current) return;

    const wrapR = wrapRef.current.getBoundingClientRect();
    const snapPos = (p) => (snapEnabled && gridSize > 0) ? Math.round(p / gridSize) * gridSize : p;

    const calcPos = (ev) => {
      let p;
      if (orientation === 'h') {
        p = Math.round((ev.clientY - wrapR.top) / zoom);
      } else {
        p = Math.round((ev.clientX - wrapR.left) / zoom);
      }
      return snapPos(p);
    };

    // Show pending guide immediately
    setPendingGuide({ orientation, position: calcPos(e) });

    const onMove = (ev) => {
      setPendingGuide({ orientation, position: calcPos(ev) });
    };

    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';

      const pos = calcPos(ev);
      const maxW = template.canvas.width;
      const maxH = template.canvas.height;
      const inRange = orientation === 'h'
        ? pos >= 0 && pos <= maxH
        : pos >= 0 && pos <= maxW;

      if (inRange) {
        const newGuide = { id: `guide-${Date.now()}`, orientation, position: pos };
        updateGuides([...guides, newGuide]);
      }
      setPendingGuide(null);
    };

    document.body.style.cursor = orientation === 'h' ? 'ns-resize' : 'ew-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [zoom, template.canvas.width, template.canvas.height, guides, updateGuides, snapEnabled, gridSize]);

  // Compute the effective guides to render (merge pending move into the list)
  const renderedGuides = pendingGuide && pendingGuide.id
    ? guides.map(g => g.id === pendingGuide.id ? { ...g, position: pendingGuide.position } : g)
    : guides;

  // Grille simple — pas unique configurable, centrée sur le canvas.
  // Le background-position décale le pattern pour qu'une ligne passe pile par
  // le centre du canvas (au lieu de partir du coin haut-gauche).
  const gridCssColor = `${gridColor}${Math.round(gridOpacity * 255).toString(16).padStart(2, '0')}`;
  const gridBackgroundImage = gridEnabled
    ? `linear-gradient(${gridCssColor} 1px, transparent 1px), linear-gradient(90deg, ${gridCssColor} 1px, transparent 1px)`
    : undefined;
  const gridBackgroundSize = gridEnabled ? `${gridSize}px ${gridSize}px` : undefined;
  const gridOffsetX = gridEnabled ? ((template.canvas.width  / 2) % gridSize) : 0;
  const gridOffsetY = gridEnabled ? ((template.canvas.height / 2) % gridSize) : 0;
  const gridBackgroundPosition = gridEnabled ? `${gridOffsetX}px ${gridOffsetY}px` : undefined;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-[#1e2a3d] overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}
    >
      {/* Rulers overlay */}
      <Rulers
        canvasW={template.canvas.width}
        canvasH={template.canvas.height}
        zoom={zoom}
        containerRect={containerRect}
        canvasOffsetX={canvasOffset.x}
        canvasOffsetY={canvasOffset.y}
        onStartGuide={handleRulerMouseDown}
      />

      {/* Centrage absolu du canvas dans le conteneur, sous les rulers */}
      <div
        className="absolute flex items-center justify-center"
        style={{ top: 24, left: 24, right: 0, bottom: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onSelect([]); }}
      >
        <div
          ref={wrapRef}
          style={{
            width: template.canvas.width * zoom,
            height: template.canvas.height * zoom,
            position: 'relative',
            flexShrink: 0
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onSelect([]); }}
          onDragOver={(e) => {
            // Accepte le drop si la palette nous a passé un type d'objet
            if (e.dataTransfer.types.includes('application/x-onair-object-type')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            const type = e.dataTransfer.getData('application/x-onair-object-type');
            if (!type || !onAdd) return;
            e.preventDefault();
            // Convertit la position client en coordonnées canvas
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            // Centre l'objet sur le curseur
            const obj = newObjectOfType(type, template.objects || [], template.canvas, { x, y }, defaultsForType(type, appTz));
            obj.x = Math.max(0, Math.min(x - obj.width / 2, template.canvas.width - obj.width));
            obj.y = Math.max(0, Math.min(y - obj.height / 2, template.canvas.height - obj.height));
            onAdd(obj);
            onSelect([obj.id]);
          }}
        >
          <div
            style={{
              width: template.canvas.width,
              height: template.canvas.height,
              backgroundColor: template.canvas.backgroundColor || '#000',
              backgroundImage: gridBackgroundImage,
              backgroundSize: gridBackgroundSize,
              backgroundPosition: gridBackgroundPosition,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'relative',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 12px 40px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onSelect([]); }}
          >
            {template.objects.map(obj => (
              <div
                key={obj.id}
                data-id={obj.id}
                onClick={(e) => { e.stopPropagation(); onSelect([obj.id]); }}
                style={{
                  position: 'absolute',
                  left: obj.x, top: obj.y,
                  width: obj.width, height: obj.height,
                  transform: `rotate(${obj.rotation || 0}deg)`,
                  zIndex: obj.zIndex || 1,
                  outline: selectedIds.includes(obj.id) ? '2px solid #3B82F6' : 'none',
                  outlineOffset: '-1px',
                  cursor: 'move'
                }}
              >
                <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
                  <TemplateObjectContent obj={obj} />
                </div>
              </div>
            ))}

            {/* Repères système (marges + milieux) — couleurs vives, non interactifs.
                Background en linear-gradient répété pour des tirets nets et bien
                visibles à toutes les tailles de zoom (le `border: dashed` CSS
                est imprévisible selon le browser et trop discret). */}
            {systemGuides.map((g, i) => {
              const color = g.kind === 'margin' ? '#F59E0B' : '#A855F7'; // ambre / violet plein
              // Taille des tirets, indépendante du zoom (en px du canvas pas écran)
              const dashOn = 12;
              const dashOff = 8;
              const isHoriz = g.orientation === 'h';
              return (
                <div key={`sys-${g.kind}-${g.orientation}-${g.position}-${i}`}
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    opacity: 0.75,
                    ...(isHoriz
                      ? {
                          left: 0, right: 0, top: g.position - 1, height: 2,
                          backgroundImage: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
                          backgroundSize: `${dashOn + dashOff}px 2px`,
                          backgroundRepeat: 'repeat-x'
                        }
                      : {
                          top: 0, bottom: 0, left: g.position - 1, width: 2,
                          backgroundImage: `linear-gradient(to bottom, ${color} 50%, transparent 50%)`,
                          backgroundSize: `2px ${dashOn + dashOff}px`,
                          backgroundRepeat: 'repeat-y'
                        }
                    ),
                    zIndex: 24
                  }}
                />
              );
            })}

            {/* Guides rendus sur le canvas */}
            {renderedGuides.map(g => {
              const isMoving = pendingGuide && pendingGuide.id === g.id;
              const labelAxis = g.orientation === 'h' ? 'Y' : 'X';
              return (
                <React.Fragment key={g.id}>
                  <div
                    style={{
                      position: 'absolute',
                      background: '#06B6D4',
                      pointerEvents: 'auto',
                      cursor: g.orientation === 'h' ? 'ns-resize' : 'ew-resize',
                      ...(g.orientation === 'h'
                        ? { left: 0, right: 0, top: g.position - 1, height: 2 }
                        : { top: 0, bottom: 0, left: g.position - 1, width: 2 }
                      ),
                      opacity: isMoving ? 0.9 : 1,
                      zIndex: 25
                    }}
                    onMouseDown={(e) => startMoveGuide(e, g.id)}
                    onDoubleClick={() => removeGuide(g.id)}
                    title="Drag pour déplacer — double-clic pour supprimer"
                  />
                  {/* Label de position — UNIQUEMENT pendant le déplacement */}
                  {isMoving && (
                    <div
                      style={{
                        position: 'absolute',
                        background: '#06B6D4',
                        color: 'white',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: `${Math.max(12, 14 / zoom)}px`,
                        fontWeight: 700,
                        padding: `${3 / zoom}px ${8 / zoom}px`,
                        borderRadius: `${4 / zoom}px`,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 27,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        ...(g.orientation === 'h'
                          ? {
                              left: `${8 / zoom}px`,
                              top: g.position - (24 / zoom),
                            }
                          : {
                              top: `${8 / zoom}px`,
                              left: g.position + (6 / zoom),
                            }
                        )
                      }}
                    >
                      {labelAxis}: {g.position}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Pending guide from ruler (nouvelle création) */}
            {pendingGuide && !pendingGuide.id && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    background: '#06B6D4',
                    opacity: 0.7,
                    pointerEvents: 'none',
                    ...(pendingGuide.orientation === 'h'
                      ? { left: 0, right: 0, top: pendingGuide.position - 1, height: 2 }
                      : { top: 0, bottom: 0, left: pendingGuide.position - 1, width: 2 }
                    ),
                    zIndex: 26
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    background: '#06B6D4',
                    color: 'white',
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    fontSize: `${Math.max(12, 14 / zoom)}px`,
                    fontWeight: 700,
                    padding: `${3 / zoom}px ${8 / zoom}px`,
                    borderRadius: `${4 / zoom}px`,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 27,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    ...(pendingGuide.orientation === 'h'
                      ? {
                          left: `${8 / zoom}px`,
                          top: pendingGuide.position - (24 / zoom),
                        }
                      : {
                          top: `${8 / zoom}px`,
                          left: pendingGuide.position + (6 / zoom),
                        }
                    )
                  }}
                >
                  {pendingGuide.orientation === 'h' ? 'Y' : 'X'}: {pendingGuide.position}
                </div>
              </>
            )}
          </div>

          {selectedIds.length > 0 && (() => {
            // Lock 1:1 si tous les objets sélectionnés sont de type "carré"
            const selectedObjs = selectedIds.map(id => template.objects.find(o => o.id === id)).filter(Boolean);
            // Si TOUS les objets sélectionnés ont un ratio fixe (carré ou ratio
            // spécifique au widget vidéo), on verrouille le resize en ratio.
            const keepRatio = selectedObjs.length > 0 && selectedObjs.every(o => ratioOf(o) !== null);
            return (
            <Moveable
              ref={moveableRef}
              target={selectedIds.map(id => wrapRef.current?.querySelector(`[data-id="${id}"]`)).filter(Boolean)}
              zoom={1 / zoom}
              draggable={true} resizable={true} rotatable={true}
              keepRatio={keepRatio}
              snappable={snapEnabled}
              snapGap={snapEnabled}
              snapCenter={snapEnabled}
              snapThreshold={6}
              // Garde les chiffres natifs Moveable (distances de snap) — ils
              // restent utiles pour voir l'écart pixel-précis entre objets.
              // Le HUD custom complète avec X/Y/W/H labellisés.
              isDisplaySnapDigit={true}
              isDisplayInnerSnapDigit={false}
              isDisplayGridGuidelines={false}
              snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
              elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
              snapGridWidth={snapEnabled ? 10 : 0}
              snapGridHeight={snapEnabled ? 10 : 0}
              verticalGuidelines={snapEnabled ? [
                0, template.canvas.width / 2, template.canvas.width,
                ...guides.filter(g => g.orientation === 'v').map(g => g.position),
                ...systemGuides.filter(g => g.orientation === 'v').map(g => g.position)
              ] : []}
              horizontalGuidelines={snapEnabled ? [
                0, template.canvas.height / 2, template.canvas.height,
                ...guides.filter(g => g.orientation === 'h').map(g => g.position),
                ...systemGuides.filter(g => g.orientation === 'h').map(g => g.position)
              ] : []}
              elementGuidelines={snapEnabled
                ? template.objects
                    .filter(o => !selectedIds.includes(o.id))
                    .map(o => wrapRef.current?.querySelector(`[data-id="${o.id}"]`))
                    .filter(Boolean)
                : []
              }
              throttleDrag={0} throttleResize={0} throttleRotate={0}
              onDrag={({ target, beforeTranslate }) => {
                const id = target.getAttribute('data-id');
                const obj = template.objects.find(o => o.id === id);
                if (!obj) return;
                const newX = Math.round(obj.x + beforeTranslate[0]);
                const newY = Math.round(obj.y + beforeTranslate[1]);
                target.style.left = `${newX}px`;
                target.style.top = `${newY}px`;
                setHudInfo({ x: newX, y: newY, w: obj.width, h: obj.height });
              }}
              onDragEnd={({ target }) => {
                const id = target.getAttribute('data-id');
                const x = parseInt(target.style.left, 10);
                const y = parseInt(target.style.top, 10);
                onUpdate(id, { x, y });
                setHudInfo(null);
              }}
              onResize={({ target, width, height, drag }) => {
                // drag.beforeTranslate = delta CUMULATIF depuis le début du drag.
                // On doit donc l'appliquer à la position INITIALE (obj.x/y dans le state),
                // pas à target.style.left (qu'on vient de modifier au frame précédent).
                const id = target.getAttribute('data-id');
                const obj = template.objects.find(o => o.id === id);
                if (!obj) return;
                const newX = Math.round(obj.x + drag.beforeTranslate[0]);
                const newY = Math.round(obj.y + drag.beforeTranslate[1]);
                const w = Math.round(width);
                const h = Math.round(height);
                target.style.width = `${w}px`;
                target.style.height = `${h}px`;
                target.style.left = `${newX}px`;
                target.style.top  = `${newY}px`;
                setHudInfo({ x: newX, y: newY, w, h });
              }}
              onResizeEnd={({ target }) => {
                const id = target.getAttribute('data-id');
                onUpdate(id, {
                  width: parseInt(target.style.width, 10),
                  height: parseInt(target.style.height, 10),
                  x: parseInt(target.style.left, 10),
                  y: parseInt(target.style.top, 10)
                });
                setHudInfo(null);
              }}
              onRotate={({ target, beforeRotate }) => {
                target.style.transform = `rotate(${beforeRotate}deg)`;
                setHudInfo(prev => prev ? { ...prev, rotation: Math.round(beforeRotate) } : prev);
              }}
              onRotateEnd={({ target }) => {
                const id = target.getAttribute('data-id');
                const rotation = parseFloat(target.style.transform.replace(/[^\d.-]/g, '')) || 0;
                onUpdate(id, { rotation });
                setHudInfo(null);
              }}
            />
            );
          })()}
        </div>
      </div>

      {/* Label dimensions + ratio — en haut à gauche (au-dessus des rulers) */}
      <div
        className="absolute top-3 left-8 text-[10px] uppercase tracking-widest text-slate-500 font-mono bg-slate-900/80 px-2 py-0.5 rounded select-none"
        style={{ zIndex: 22 }}
      >
        {template.canvas.width} × {template.canvas.height} · {aspectRatioLabel(template.canvas.width, template.canvas.height)}
      </div>

      {/* HUD pendant drag/resize/rotate — affiche position + taille de l'objet
          en cours de manipulation. Positionné en haut à droite du canvas pour
          ne pas masquer la zone de travail. z-index 9999 pour passer au-dessus
          des guides Moveable (qui sont en z-index 3000). */}
      {hudInfo && (
        <div
          className="absolute top-3 right-3 bg-slate-900/95 border border-white/10 rounded-md px-3 py-2 select-none shadow-lg shadow-black/40 pointer-events-none"
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-200">
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500">X</span>
              <span className="font-bold text-blue-300">{hudInfo.x}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500">Y</span>
              <span className="font-bold text-blue-300">{hudInfo.y}</span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500">W</span>
              <span className="font-bold text-slate-100">{hudInfo.w}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500">H</span>
              <span className="font-bold text-slate-100">{hudInfo.h}</span>
            </div>
            {hudInfo.rotation !== undefined && (
              <>
                <span className="text-slate-700">·</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500">R</span>
                  <span className="font-bold text-amber-300">{hudInfo.rotation}°</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
