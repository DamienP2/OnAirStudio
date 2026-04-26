import { useReducer, useCallback } from 'react';

const MAX_HISTORY = 50;

function snapshot(state) {
  return { objects: state.template ? state.template.objects.map(o => ({ ...o, props: { ...o.props } })) : [] };
}

// Quand `txActive` est vrai (drag-scrub d'un champ, drag/resize Moveable),
// les UPDATE_* n'empilent pas de snapshot — un seul snapshot a été poussé
// au BEGIN_TX. END_TX referme la transaction sans rien empiler.
function pushUndo(state) {
  return [snapshot(state), ...state.undo].slice(0, MAX_HISTORY);
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_TEMPLATE':
      return { template: action.template, selectedIds: [], undo: [], redo: [], txActive: false };
    case 'SELECT':
      return { ...state, selectedIds: action.ids };
    case 'BEGIN_TX': {
      if (state.txActive) return state;
      return { ...state, txActive: true, undo: pushUndo(state), redo: [] };
    }
    case 'END_TX': {
      if (!state.txActive) return state;
      return { ...state, txActive: false };
    }
    case 'ADD_OBJECT': {
      const undo = state.txActive ? state.undo : pushUndo(state);
      return {
        ...state,
        template: { ...state.template, objects: [...state.template.objects, action.obj] },
        selectedIds: [action.obj.id], undo, redo: []
      };
    }
    case 'UPDATE_OBJECT': {
      const undo = state.txActive ? state.undo : pushUndo(state);
      return {
        ...state,
        template: {
          ...state.template,
          objects: state.template.objects.map(o =>
            o.id === action.id ? { ...o, ...action.changes, props: { ...o.props, ...(action.changes.props || {}) } } : o
          )
        },
        undo, redo: []
      };
    }
    case 'DELETE_SELECTED': {
      if (state.selectedIds.length === 0) return state;
      const undo = state.txActive ? state.undo : pushUndo(state);
      return {
        ...state,
        template: { ...state.template, objects: state.template.objects.filter(o => !state.selectedIds.includes(o.id)) },
        selectedIds: [], undo, redo: []
      };
    }
    case 'DUPLICATE_SELECTED': {
      if (state.selectedIds.length === 0) return state;
      const undo = state.txActive ? state.undo : pushUndo(state);
      const copies = state.template.objects.filter(o => state.selectedIds.includes(o.id)).map(o => ({
        ...o, id: `${o.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: o.x + 20, y: o.y + 20,
        props: { ...o.props }
      }));
      return {
        ...state,
        template: { ...state.template, objects: [...state.template.objects, ...copies] },
        selectedIds: copies.map(c => c.id), undo, redo: []
      };
    }
    case 'UPDATE_CANVAS': {
      const undo = state.txActive ? state.undo : pushUndo(state);
      return { ...state, template: { ...state.template, canvas: { ...state.template.canvas, ...action.changes } }, undo, redo: [] };
    }
    case 'UNDO': {
      if (state.undo.length === 0) return state;
      const [prev, ...rest] = state.undo;
      const redo = [snapshot(state), ...state.redo].slice(0, MAX_HISTORY);
      return { ...state, template: { ...state.template, objects: prev.objects }, undo: rest, redo, txActive: false };
    }
    case 'REDO': {
      if (state.redo.length === 0) return state;
      const [next, ...rest] = state.redo;
      const undo = [snapshot(state), ...state.undo].slice(0, MAX_HISTORY);
      return { ...state, template: { ...state.template, objects: next.objects }, undo, redo: rest, txActive: false };
    }
    default: return state;
  }
}

const initial = { template: null, selectedIds: [], undo: [], redo: [], txActive: false };

export function useDesignerState() {
  const [state, dispatch] = useReducer(reducer, initial);
  return {
    state,
    loadTemplate: (t) => dispatch({ type: 'LOAD_TEMPLATE', template: t }),
    select: (ids) => dispatch({ type: 'SELECT', ids }),
    addObject: (obj) => dispatch({ type: 'ADD_OBJECT', obj }),
    updateObject: useCallback((id, changes) => dispatch({ type: 'UPDATE_OBJECT', id, changes }), []),
    deleteSelected: () => dispatch({ type: 'DELETE_SELECTED' }),
    duplicateSelected: () => dispatch({ type: 'DUPLICATE_SELECTED' }),
    updateCanvas: (changes) => dispatch({ type: 'UPDATE_CANVAS', changes }),
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),
    beginTransaction: useCallback(() => dispatch({ type: 'BEGIN_TX' }), []),
    endTransaction: useCallback(() => dispatch({ type: 'END_TX' }), [])
  };
}
