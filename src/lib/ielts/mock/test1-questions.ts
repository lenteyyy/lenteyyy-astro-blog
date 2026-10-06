// Text recognised from Cambridge IELTS 21 Test 1, then proofread against the source pages.
// {{n}} marks the exact numbered gap in a completion question.
export type Choice = { letter: string; text: string };
export type QuestionBlock =
  | { type: 'image'; url: string; alt: string }
  | { type: 'heading' | 'instruction' | 'subheading' | 'paragraph'; text: string }
  | { type: 'table'; title: string; columns: string[]; rows: string[][] }
  | { type: 'notes'; title: string; groups: { heading?: string; intro?: string[]; items: string[] }[] }
  | { type: 'summary'; title: string; paragraphs: string[] }
  | { type: 'flow'; title: string; steps: string[] }
  | { type: 'bank'; title: string; options: Choice[] }
  | { type: 'choice'; number: number; prompt: string; options: Choice[] }
  | { type: 'pair'; numbers: [number, number]; prompt: string; options: Choice[] }
  | { type: 'match'; title?: string; flow?: boolean; options: Choice[]; rows: { number: number; text: string }[] }
  | { type: 'statements'; options: string[]; rows: { number: number; text: string }[] };

const abc = (texts: string[]): Choice[] => texts.map((text, index) => ({ letter: String.fromCharCode(65 + index), text }));

export const questionSets: { listening: QuestionBlock[][]; reading: QuestionBlock[][] } = {
  listening: [
    [
      { type: 'heading', text: 'Questions 1–6' },
      { type: 'instruction', text: 'Complete the table below.' },
      { type: 'instruction', text: 'Write ONE WORD AND/OR A NUMBER for each answer.' },
      { type: 'table', title: 'Oyster Bay Sailing Club Courses', columns: ['Name of course', 'What you learn', 'Cost', 'Other information'], rows: [
        ['Taster day', 'introduction to sailing', '£120 if booking one place', 'small groups (max {{1}} people)'],
        ['Level 1', 'basic theory e.g. understanding the {{2}} and tides\n\nbasic sailing skills including {{3}} information', '£200\n\n{{4}} available for club members\n\nall inclusive (plus a useful {{5}})', 'a {{6}} at the end of the course for all participants'],
      ] },
      { type: 'heading', text: 'Questions 7–10' },
      { type: 'instruction', text: 'Complete the notes below.' },
      { type: 'instruction', text: 'Write ONE WORD ONLY for each answer.' },
      { type: 'notes', title: 'General information', groups: [{ items: [
        'Participants must be able to swim.',
        'Bring suitable clothing, a {{7}} and toiletries (e.g. shampoo).',
        'There is a {{8}} at the club.',
        'Online training {{9}} are recommended.',
        '{{10}} are available for course participants.',
      ] }] },
    ],
    [
      { type: 'heading', text: 'Questions 11–16' },
      { type: 'instruction', text: 'Choose the correct letter, A, B or C.' },
      { type: 'subheading', text: 'Working as a makeup trainee' },
      { type: 'choice', number: 11, prompt: 'What should trainees always expect to get when working on low budget short films?', options: abc(['travel expenses', 'a minimum wage', 'meals']) },
      { type: 'choice', number: 12, prompt: 'According to the speaker, on big budget films trainees may get experience of', options: abc(['makeup for special effects.', 'working with different ethnicities.', 'creating a variety of hair styles.']) },
      { type: 'choice', number: 13, prompt: 'The speaker says a problem for makeup artists is', options: abc(['dealing with difficult directors.', 'being shouted at by their supervisor.', 'waiting around for hours doing nothing.']) },
      { type: 'choice', number: 14, prompt: 'How did the speaker feel when she met famous actors for the first time?', options: abc(['very shy', 'very proud', 'very disappointed']) },
      { type: 'choice', number: 15, prompt: 'What advice does the speaker give about makeup kits?', options: abc(['Always carry a basic kit with you.', 'Only buy the best products for a makeup kit.', 'Ask other makeup artists to check your kit.']) },
      { type: 'choice', number: 16, prompt: 'What advice does the speaker give about creating a portfolio?', options: abc(['Keep print and digital photos.', 'Only include a small selection of photos.', 'Get permission to use photos.']) },
      { type: 'heading', text: 'Questions 17–20' },
      { type: 'instruction', text: 'What ability is required for each of the following duties?' },
      { type: 'instruction', text: 'Write the correct letter, A, B or C, next to Questions 17–20.' },
      { type: 'match', title: 'Duties', options: abc(['being well-organised', 'being flexible', 'working quickly']), rows: [
        { number: 17, text: 'Prepping an actor' }, { number: 18, text: 'Continuity' },
        { number: 19, text: 'General' }, { number: 20, text: 'Applying makeup' },
      ] },
    ],
    [
      { type: 'heading', text: 'Questions 21 and 22' },
      { type: 'instruction', text: 'Choose TWO letters, A–E.' },
      { type: 'pair', numbers: [21, 22], prompt: 'Which TWO features of the lecture on ocean biodiversity had the greatest impact on the students?', options: abc([
        'the references to local problems', 'the broad focus of the examples', 'the practical suggestions for solutions',
        'the type of issues discussed', 'the implications for government policy',
      ]) },
      { type: 'heading', text: 'Questions 23 and 24' },
      { type: 'instruction', text: 'Choose TWO letters, A–E.' },
      { type: 'pair', numbers: [23, 24], prompt: 'Which TWO details about the research project particularly impressed the students?', options: abc([
        'the team’s previous successes', 'its wide geographical scale', 'the use of new technology',
        'the extensive statistical evidence', 'the large range of specialists involved',
      ]) },
      { type: 'heading', text: 'Questions 25–30' },
      { type: 'instruction', text: 'What is the students’ opinion of each of the following resources related to ocean biodiversity?' },
      { type: 'instruction', text: 'Choose SIX answers from the box and write the correct letter, A–H, next to Questions 25–30.' },
      { type: 'match', title: 'Resources', options: abc([
        'This is aimed at a very specialist audience.', 'This is now rather outdated.',
        'This was an effective description of a new danger.', 'This suggests possible ways to improve the situation.',
        'This does not give a balanced account.', 'This is too predictable to be useful.',
        'This gives insufficient evidence for its claims.', 'This gives a clear explanation of the problems.',
      ]), rows: [
        { number: 25, text: 'Article on invasive lionfish' }, { number: 26, text: 'Documentary on microplastics' },
        { number: 27, text: 'Podcast on ocean pollution' }, { number: 28, text: 'Book on coastal ecosystems' },
        { number: 29, text: 'Article on metal toxicity' }, { number: 30, text: 'Podcast on floating marine cities' },
      ] },
    ],
    [
      { type: 'instruction', text: 'Complete the notes below.' },
      { type: 'instruction', text: 'Write ONE WORD ONLY for each answer.' },
      { type: 'notes', title: 'Sources of rubber', groups: [
        { heading: 'Three resources which are essential for industrial civilisation', items: ['{{31}}', 'fossil fuels', 'rubber'] },
        { heading: 'Natural rubber', intro: [
          'This mainly comes from the Pará rubber tree, now cultivated in South-East Asia.',
          'The supply is limited because',
        ], items: [
          'the growth of the tree is {{32}}',
          'production cannot easily be adjusted because of increasing or decreasing {{33}}',
          'the tree only grows near the {{34}}',
          'extracting the latex (rubber) is labour-intensive',
          'it is very difficult to {{35}} rubber after production.',
        ] },
        { heading: 'New threats include', items: [
          'lack of genetic diversity, leading to danger of disease caused by a {{36}}',
          'a shift to the cultivation of palm oil', 'extreme {{37}} events.',
        ] },
        { heading: 'Synthetic rubber', items: [
          'may be used for engine parts and cooking utensils', 'is less {{38}} than natural rubber',
          'is unsuitable for many purposes e.g. the tyres of aircraft.',
        ] },
        { heading: 'An alternative source of natural rubber', items: [
          'A wild flower (a type of dandelion) has rubber in its {{39}}.',
          'It can be grown in many locations and does not require good {{40}}.',
        ] },
      ] },
    ],
  ],
  reading: [
    [
      { type: 'heading', text: 'Questions 1–7' },
      { type: 'instruction', text: 'Complete the notes below.' },
      { type: 'instruction', text: 'Choose ONE WORD ONLY from the passage for each answer.' },
      { type: 'instruction', text: 'Write your answers in boxes 1–7 on your answer sheet.' },
      { type: 'notes', title: 'Gwendoline and Margaret Davies', groups: [
        { heading: 'Family and early life', items: [
          'their grandfather’s wealth came from {{1}} and transportation businesses',
          'their upbringing gave them a sense of social responsibility',
          'their {{2}} was designed to give them an interest in activities such as collecting art',
          'their governess took them on trips to art galleries',
          'they took lengthy {{3}} about the things they saw in art galleries',
        ] },
        { heading: 'The sisters as art collectors', items: [
          'their {{4}} showed they liked Old Master paintings, but they were expensive to buy',
          'their early purchases were safe, popular paintings',
          'the first Impressionist paintings they bought showed places in {{5}}',
        ] },
        { heading: 'Impact of First World War', items: [
          'they helped bring artists from Belgium to Wales', 'they worked in a {{6}} for soldiers in France',
        ] },
        { heading: 'Opinions about the sisters as art collectors', items: [
          'were not considered typical collectors – they lived in isolation in the countryside and did not have any {{7}} who were artists',
        ] },
      ] },
      { type: 'heading', text: 'Questions 8–13' },
      { type: 'instruction', text: 'Do the following statements agree with the information given in Reading Passage 1?' },
      { type: 'instruction', text: 'In boxes 8–13 on your answer sheet, write' },
      { type: 'bank', title: '', options: [
        { letter: 'TRUE', text: 'if the statement agrees with the information' },
        { letter: 'FALSE', text: 'if the statement contradicts the information' },
        { letter: 'NOT GIVEN', text: 'if there is no information on this' },
      ] },
      { type: 'statements', options: ['TRUE', 'FALSE', 'NOT GIVEN'], rows: [
        { number: 8, text: 'The Davies sisters’ childhood influenced the way they decided to use their wealth.' },
        { number: 9, text: 'The Jean-Baptiste-Camille Corot paintings in the Davies sisters’ collection were purchased from a gallery in France.' },
        { number: 10, text: 'Hugh Blaker opposed the Davies sisters’ decision to buy art by French Impressionists.' },
        { number: 11, text: 'The exhibition of Cézanne paintings at the Bath gallery was very popular with the public.' },
        { number: 12, text: 'The impact of the First World War encouraged Gwendoline to reconsider her interest in collecting art.' },
        { number: 13, text: 'The Davies sisters bought French Impressionist art during a period when very few people were doing so.' },
      ] },
    ],
    [
      { type: 'heading', text: 'Questions 14–17' },
      { type: 'instruction', text: 'Reading Passage 2 has seven sections, A–G. Which section contains the following information?' },
      { type: 'instruction', text: 'Write the correct letter, A–G, in boxes 14–17 on your answer sheet.' },
      { type: 'match', options: abc(['Section A', 'Section B', 'Section C', 'Section D', 'Section E', 'Section F', 'Section G']), rows: [
        { number: 14, text: 'examples of strategies to decrease the noise that the public are exposed to' },
        { number: 15, text: 'data indicating the extent of the problem of excessive noise' },
        { number: 16, text: 'a description of physiological changes in our bodies when we hear sudden noises' },
        { number: 17, text: 'evidence that a relatively quiet environment can be more beneficial than a totally silent one' },
      ] },
      { type: 'heading', text: 'Questions 18–21' },
      { type: 'instruction', text: 'Complete the summary below.' },
      { type: 'instruction', text: 'Choose ONE WORD ONLY from the passage for each answer.' },
      { type: 'instruction', text: 'Write your answers in boxes 18–21 on your answer sheet.' },
      { type: 'summary', title: 'Flotation Tanks', paragraphs: [
        'According to Justin Feinstein, flotation tanks allow people to concentrate on their own {{18}}, which helps them relax and enables them to meditate.',
        'Feinstein and his colleagues conducted an experiment in which 50 people, who were all suffering from stress and related issues, were given a {{19}} to complete before and after using a flotation tank. Participants reported a reduction in their symptoms after an hour in the tank, together with signs of relaxation and improved general {{20}}.',
        'In another experiment, the researchers had 48 people spend periods of 90 minutes either lying back in a chair or floating in a tank. Brain scans then revealed that those people who had been in a tank had decreased activity in parts of the brain associated with {{21}}.',
      ] },
      { type: 'heading', text: 'Questions 22–26' },
      { type: 'instruction', text: 'Look at the following statements (Questions 22–26) and the list of people below.' },
      { type: 'instruction', text: 'Match each statement with the correct person, A, B, C or D.' },
      { type: 'instruction', text: 'Write the correct letter, A, B, C or D, in boxes 22–26 on your answer sheet.' },
      { type: 'instruction', text: 'NB You may use any letter more than once.' },
      { type: 'match', title: 'List of People', options: abc(['Nick Antonio', 'Justin Feinstein', 'Tal Dotan Ben-Soussan', 'Eric Pfeifer']), rows: [
        { number: 22, text: 'It is unpleasant and upsetting for people to be placed in a silent environment against their will.' },
        { number: 23, text: 'The trend towards creating quieter urban locations is likely to increase in the coming years.' },
        { number: 24, text: 'When our body’s senses are completely deprived of input, our minds compensate for this by creating the illusion of images and sounds.' },
        { number: 25, text: 'Even a short amount of silent time can have a positive impact.' },
        { number: 26, text: 'External and internal quietness makes us more conscious of events occurring in our surroundings and helps us react appropriately to these events.' },
      ] },
    ],
    [
      { type: 'heading', text: 'Questions 27–30' },
      { type: 'instruction', text: 'Choose the correct letter, A, B, C or D.' },
      { type: 'choice', number: 27, prompt: 'What does the reviewer suggest about the cultivation and trading of sugar in the first paragraph?', options: abc([
        'Sugar has played a major role in international relations.', 'Beet sugar has been made more internationally competitive.',
        'Cane sugar is thought to be of superior quality to beet sugar.', 'New locations for cultivating sugar have increased production.',
      ]) },
      { type: 'choice', number: 28, prompt: 'In the second paragraph, when discussing the sugar market in Britain, the reviewer stresses', options: abc([
        'how the sources used changed over time.', 'how developments in agriculture affected trade.',
        'the increased demand for sugar over the years.', 'the growing support for ethical methods of cultivation.',
      ]) },
      { type: 'choice', number: 29, prompt: 'What is the reviewer doing in the third paragraph?', options: abc([
        'describing an efficient approach to sugar cultivation', 'explaining why the use of sugar plantations declined',
        'addressing a misconception about the growing of sugar cane', 'evaluating different approaches to the cultivation of sugar cane',
      ]) },
      { type: 'choice', number: 30, prompt: 'In the final paragraph, what does the reviewer suggest is the overall message of Bosma’s book?', options: abc([
        'Sugar is a harmful and unnecessary product.', 'Economic pressure is needed to control sugar production.',
        'Conditions for workers in sugar production should be improved.', 'Intensive marketing of sugar has had disastrous consequences.',
      ]) },
      { type: 'heading', text: 'Questions 31–36' },
      { type: 'instruction', text: 'Complete the summary using the list of words, A–I, below.' },
      { type: 'instruction', text: 'Write the correct letter, A–I, in boxes 31–36 on your answer sheet.' },
      { type: 'summary', title: 'Sugar cultivation and production', paragraphs: [
        'The book The World of Sugar points out the similarities in the way that sugar was cultivated around the world. In the big industries in both Germany and the US, sugar farming depended on {{31}}. However, in other parts of the world such as South Asia and Latin America, {{32}} continued.',
        'Sugar production has also involved {{33}} who were eager to protect their markets. In countries such as Cuba the sugar industry therefore had a major influence on {{34}}.',
        'To support the interests of sugar producers, {{35}} were established. As a result of this, {{36}} were penalised.',
      ] },
      { type: 'bank', title: 'List of words', options: abc([
        'national governments', 'agricultural developments', 'less wealthy nations',
        'untrained workers', 'small-scale cultivation', 'outdated methods',
        'financial controls', 'migrant workers', 'powerful individuals and businesses',
      ]) },
      { type: 'heading', text: 'Questions 37–40' },
      { type: 'instruction', text: 'Do the following statements agree with the views of the writer in Reading Passage 3?' },
      { type: 'instruction', text: 'In boxes 37–40 on your answer sheet, write' },
      { type: 'bank', title: '', options: [
        { letter: 'YES', text: 'if the statement agrees with the views of the writer' },
        { letter: 'NO', text: 'if the statement contradicts the views of the writer' },
        { letter: 'NOT GIVEN', text: 'if it is impossible to say what the writer thinks about this' },
      ] },
      { type: 'statements', options: ['YES', 'NO', 'NOT GIVEN'], rows: [
        { number: 37, text: 'Sugar has now become available in large quantities due to a range of agricultural developments.' },
        { number: 38, text: 'Advertisers initially marketed sugar as a luxury product.' },
        { number: 39, text: 'The invention of high-fructose corn syrup was a positive development.' },
        { number: 40, text: 'High-fructose corn syrup is an ingredient in many processed foods.' },
      ] },
    ],
  ],
};
