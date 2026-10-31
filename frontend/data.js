export const image = (id, width = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

export const categories = ['All artwork', 'Painting', 'Photography', 'Digital art', 'Sculpture', 'Illustration', 'Mixed media'];

export const demoArtists = [
  { id: 'demo-artist-1', full_name: 'Maya Bennett', talent_skill: 'Painting', location: 'London, UK', bio: 'Finding a little wonder in the everyday.', avatar: 'photo-1534528741775-53994a69daeb', demo: true },
  { id: 'demo-artist-2', full_name: 'Alex Morgan', talent_skill: 'Photography', location: 'Portland, US', bio: 'Quiet places. Untold stories. Natural light.', avatar: 'photo-1500648767791-00dcc994a43e', demo: true },
  { id: 'demo-artist-3', full_name: 'Sofia Chen', talent_skill: 'Digital art', location: 'Berlin, Germany', bio: 'An exploration of color, form, and feeling.', avatar: 'photo-1524504388940-b1c1722653e1', demo: true },
  { id: 'demo-artist-4', full_name: 'Oliver James', talent_skill: 'Sculpture', location: 'Bristol, UK', bio: 'Earth, texture, and objects with a story.', avatar: 'photo-1506794778202-cad84cf45f1d', demo: true },
  { id: 'demo-artist-5', full_name: 'Elena Rossi', talent_skill: 'Illustration', location: 'Florence, Italy', bio: 'Little worlds made with ink and imagination.', avatar: 'photo-1524250502761-1ac6f2e30d43', demo: true },
  { id: 'demo-artist-6', full_name: 'Noah Williams', talent_skill: 'Mixed media', location: 'Melbourne, Australia', bio: 'Making room for the unexpected.', avatar: 'photo-1517841905240-472988babdf9', demo: true },
];

const works = [
  ['Between the lines', 'Painting', 'photo-1549490349-8643362247b5', 0, 'A playful dialogue of soft color, organic shapes, and expressive marks.'],
  ['The art of slowing down', 'Photography', 'photo-1441974231531-c6227db76b6e', 1, 'A moment of stillness, deep in a sunlit forest.'],
  ['A different perspective', 'Digital art', 'photo-1634017839464-5c339ebe3cb4', 2, 'Fluid color and unexpected forms, moving between the real and imagined.'],
  ['Made of earth', 'Sculpture', 'photo-1493106641515-6b5631de4bb9', 3, 'An exploration of tactile surfaces and the beauty of handmade objects.'],
  ['A quiet kind of magic', 'Painting', 'photo-1579783902614-a3fb3927b6a5', 0, 'Light, memory, and all the small things that stay with us.'],
  ['Botanical daydream', 'Illustration', 'photo-1497250681960-ef046c08a56e', 4, 'An ode to growing things, rendered in a fresh green palette.'],
  ['In good company', 'Mixed media', 'photo-1577083552431-6e5fd01aa342', 5, 'Layers of paint and paper finding their own rhythm.'],
  ['Chasing the light', 'Photography', 'photo-1470252649378-9c29740c9fa8', 1, 'A landscape softened by the first light of the morning.'],
];

export const demoArtworks = works.map(([title, category, photo, artistIndex, description], index) => ({
  id: `demo-art-${index + 1}`, title, category, description, media_url: image(photo), media_type: 'image',
  artist: demoArtists[artistIndex], artist_id: demoArtists[artistIndex].id,
  ai_tags: [category.toLowerCase(), 'independent artist', 'inspiration'], created_at: `2026-10-${String(24 - index).padStart(2, '0')}T12:00:00`, demo: true,
}));

export const demoEvents = [
  { id: 'demo-event-1', title: 'The independent art fair', description: 'Bring your unique perspective to a weekend celebrating independent artists. An open call for painters, illustrators, and makers to exhibit their work in a welcoming creative space.', budget: 25000, event_date: '2026-12-12T10:00:00', status: 'open', event_poster_url: image('photo-1577720643272-265f09367456'), label: 'OPEN CALL', demo: true },
  { id: 'demo-event-2', title: 'A new perspective', description: 'A group exhibition exploring new ways of seeing familiar places. We are looking for photographers and mixed-media artists with a distinctive point of view.', budget: 18000, event_date: '2026-12-20T10:00:00', status: 'open', event_poster_url: image('photo-1579783901586-d88db74b4fe4'), label: 'EXHIBITION', demo: true },
  { id: 'demo-event-3', title: 'Create something together', description: 'A collaborative residency for artists ready to exchange ideas and experiment with different disciplines. Develop a new body of work alongside a small community of makers.', budget: 40000, event_date: '2027-01-15T10:00:00', status: 'open', event_poster_url: image('photo-1513364776144-60967b0f800f'), label: 'RESIDENCY', demo: true },
];
