// Templates pré-livrés reproduisant les anciens modes "two" et "three"
const DEFAULT_TWO_CLOCKS = {
  id: 'default-two-clocks',
  name: '2 horloges',
  canvas: { width: 1920, height: 1080, backgroundColor: '#000000', backgroundImage: null },
  objects: [
    {
      id: 'current', type: 'analog-clock-current',
      x: 160, y: 190, width: 700, height: 700, rotation: 0, zIndex: 1,
      props: { showSeconds: true, dialColor: '#FFFFFF', handColor: '#FFFFFF', hourColor: '#FFFFFF', secondColor: '#EF4444', centerColor: '#FFFFFF' }
    },
    {
      id: 'remaining', type: 'analog-clock-remaining',
      x: 1060, y: 190, width: 700, height: 700, rotation: 0, zIndex: 1,
      props: { showSeconds: true, dialColor: '#FFFFFF', handColor: '#EF4444', hourColor: '#FFFFFF', secondColor: '#EF4444', centerColor: '#EF4444' }
    },
    {
      id: 'onair', type: 'onair-badge',
      x: 830, y: 950, width: 260, height: 90, rotation: 0, zIndex: 2,
      props: { text: 'ON AIR', activeColor: '#EF4444', inactiveColor: '#374151', fontSize: 56, borderRadius: 12 }
    }
  ],
  createdAt: '2026-04-24T00:00:00Z', updatedAt: '2026-04-24T00:00:00Z'
};

const DEFAULT_THREE_CLOCKS = {
  id: 'default-three-clocks',
  name: '3 horloges',
  canvas: { width: 1920, height: 1080, backgroundColor: '#000000', backgroundImage: null },
  objects: [
    {
      id: 'current', type: 'analog-clock-current',
      x: 90, y: 270, width: 540, height: 540, rotation: 0, zIndex: 1,
      props: { showSeconds: true, dialColor: '#FFFFFF', handColor: '#FFFFFF', hourColor: '#FFFFFF', secondColor: '#EF4444', centerColor: '#FFFFFF' }
    },
    {
      id: 'elapsed', type: 'analog-clock-elapsed',
      x: 690, y: 270, width: 540, height: 540, rotation: 0, zIndex: 1,
      props: { showSeconds: true, dialColor: '#FFFFFF', handColor: '#3B82F6', hourColor: '#FFFFFF', secondColor: '#3B82F6', centerColor: '#3B82F6' }
    },
    {
      id: 'remaining', type: 'analog-clock-remaining',
      x: 1290, y: 270, width: 540, height: 540, rotation: 0, zIndex: 1,
      props: { showSeconds: true, dialColor: '#FFFFFF', handColor: '#EF4444', hourColor: '#FFFFFF', secondColor: '#EF4444', centerColor: '#EF4444' }
    },
    {
      id: 'onair', type: 'onair-badge',
      x: 830, y: 950, width: 260, height: 90, rotation: 0, zIndex: 2,
      props: { text: 'ON AIR', activeColor: '#EF4444', inactiveColor: '#374151', fontSize: 56, borderRadius: 12 }
    }
  ],
  createdAt: '2026-04-24T00:00:00Z', updatedAt: '2026-04-24T00:00:00Z'
};

module.exports = { DEFAULT_TWO_CLOCKS, DEFAULT_THREE_CLOCKS };
