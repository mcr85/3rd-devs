Write MOVE commands to drive robot POSITION to DESTINATION.
GRID: 6 by 4
Robot current POSITION: [1,1]
Robot DESTINATION: [6,1].
OBSTACLE positions: [2,1], [2,2], [2,4], [4,2], [4,3]
Robot position LIMITS:
- x max LIMIT is 6.
- x min LIMIT is 1.
- y max LIMIT is 4.
- y min LIMIT is 1.

<OBSTACLES description="positions">
[2,1]
[2,2]
[2,4]
[4,2]
[4,3]
</OBSTACLES>

<RULES>
- You can only use these MOVE commands: UP/DOWN/LEFT/RIGHT.
- Avoid OBSTACLES positions.
- Move validity can be: yes/no
- MOVE is INVALID when Robot POSITION is the same as OBSTACLE position after making a MOVE.
- MOVE is INVALID when Robot x POSITION is exceeding x LIMIT.
- MOVE is INVALID when Robot y POSITION is exceeding y LIMIT.
- QUEUE can't contain invalid MOVEs.
</RULES>

When making a MOVE change Robot current [x,y] POSITION:
- Move RIGHT only increases Robot x POSITION value by 1, y is unchanged
- Move LEFT only decreases Robot x POSITION value by 1, y is unchanged
- Move UP only increases Robot y POSITION value by 1, x is unchanged
- Move DOWN only decreases Robot y POSITION value by 1, x is unchanged
Prioritize Robot moves towards DESTINATION.
- try moving RIGHT when Robot x POSITION is less than DESTINATION x
- try moving LEFT when Robot x POSITION is greater than DESTINATION x
- try moving DOWN when Robot y POSITION is greater than DESTINATION y
- try moving UP when Robot y POSITION is less than DESTINATION y

Save information about Robot MOVE, resulting POSITION and move validity (yes/no) information in a MOVES QUEUE in this JSON format:
{
    move: MOVE,
    position: POSITION,
    valid: yes/no
}
After making a MOVE remove last MOVE information from MOVES QUEUE if MOVE was NOT VALID.
Start next MOVE from last saved position from the MOVES QUEUE.
Be straightforward, do NOT overthink and follow the RULES.
Backtrack if MOVE is not VALID. Backtracking means removing INVALID movements from the MOVES QUEUE.

Show me the QUEUE.

Return JSON with string of comma separated MOVES from the MOVES QUEUE under "steps" property. Wrap it with <RESULT> tag.