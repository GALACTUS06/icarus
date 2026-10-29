# Icarus

A one-page flight over the sea. Climb as high as the wax will bear. The sun, the birds, and the water are how a flight ends.

**[Play Icarus](https://galactus06.github.io/icarus/)**

The first visit opens the lessons on the hangar. After that, **How to fly** brings them back. During a flight the corner of the screen shows only the score and the purse. Nothing there names a height, a limit, or how many tears the wings have left.

## Hold to climb

Hold Space, or press and hold on the sky. Let go and he falls. The world moves forward on its own.

![Holding the climb above the sea](screenshots/climb.png)

## How the score grows

Every moment of flight adds a little score. The amount is the distance just traveled, multiplied by the square of his height above the sea. That height is a fraction of the sky, and it never counts as more than the top of the sky.

Near the waves the fraction is tiny, and squaring it makes the score crawl. Higher up the fraction grows, and the same distance is worth much more. At the top of the sky the fraction is 1, so the distance counts in full.

When the flight ends, that score is added to the purse. The purse stays in this browser. A new browser, or a private window, starts again from nothing.

The line that does this is in `js/game.js`, inside `updateFlight`.

![Low over the waves, the score has barely moved](screenshots/score-low.png)

![High, near the sun, the same kind of flight is worth much more](screenshots/score-high.png)

## The wings

You begin with basic wax. Spend the purse in the hangar before you fly. Switching pairs before takeoff gives back what you have not yet spent in the air.

![The hangar, with the four pairs](eportfolio/hangar.png)

| Pair | Price | What the hangar says |
| --- | --- | --- |
| Basic wax | Free | A first pair. It will carry you into the middle sky. |
| Gull | 200 | Climbs easily, and a little more sky feels welcome. |
| Reinforced wax | 560 | Heavier on the climb. The wax holds longer. |
| Daedalus's spare | 1,400 | Strong climb, and the most time near the sun. |

A bought pair lasts one flight. The sea, the things in it, a bird, or the sun destroys the pair you bought. Unspent money remains, and the basic wings are always there. There is no refund after a crash.

## The wax

Stay high and the sky warms. The wax shines. Then the wings are gone, all at once, and he falls. Nothing tells you the height a pair can bear, and the sun does not stay still.

![The sky warms when he stays too high](screenshots/wax.png)

![The wings gave out](eportfolio/wings-gave-out.png)

## Birds

Gulls cross the path one at a time, and also in a loose scatter. The scatter is not a stacked line. The gaps are wide enough to slip through.

Hit one and it falls. Feathers come off the wings too. The wings look worse and climb worse. Enough tears and they come apart, all at once. Nothing counts the damage for you. Gulls you miss keep flying.

![Gulls scattered across the path, with room to slip between them](screenshots/gulls.png)

## The sea

Touch the water and the flight is over. If you never climb, that is where he goes.

Fish, sharks, and squid stay hidden, then show up suddenly near him. They only matter if he is low. Stay over one and it can rise out of the water and take him. High flight is out of their reach. At night you do not see them until they are close.

![A shark breaks the surface under a low flight](screenshots/sea.png)

## Columns

A pale column of rising air lifts him even when you let go, and it leans toward the sun. That is a free climb in a direction you did not choose. Ride it, or slip out before the wax shines.

Columns are not copies of each other. Some are short and barely leave the water. Some are thin. Some start higher and reach much farther toward the sun. Staying inside a tall one is the dangerous choice.

![A short column by the cliff, and a tall one leaning into the sun](screenshots/columns.png)

## Weather

The sky fades from one spell to the next. A flight begins clear. You can see each spell. Nothing names it while you fly.

- **Heat** hurries the wax. The sun looks larger, and the sky goes gold.
- **Rain** weighs the wings, and they climb less. The sky grays and the rain is bright.
- **Cloud** hides the sun and brings more gulls.
- **Wind** shoves from whichever way it is blowing. The direction is random, and it changes.
- **Night** puts the sun out, so the wax rests. Gulls and the things in the sea are only visible when they are close. The score can stay high. The danger is what you cannot see.

![Heat](screenshots/heat.png)

![Rain](screenshots/rain.png)

![Cloud](screenshots/cloud.png)

![Wind](screenshots/wind.png)

![Night. A gull is visible only because it is close](screenshots/night.png)

## Run it locally

The game is plain HTML, CSS, and one canvas script. There is no build step and no install.

```bash
python -m http.server 8766
```

Then open http://127.0.0.1:8766/
