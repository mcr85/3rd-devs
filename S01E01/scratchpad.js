const markdown = "### Xplore Your Zone\n\nThe best patrolling robots for your factory.\n\nProve that you are not human\n\nQuestion:\n\nRok zabójstwa Johna F. Kennedy'ego?\n\nLogin [Forget password?](forget.php)\n\n[Register new account](/register)"

const lines = markdown.split('\n').filter(Boolean);
const questionLabelIndex = lines.findIndex(item => item === 'Question:');
const question = lines[questionLabelIndex + 1];

console.log('mcr', question); 


