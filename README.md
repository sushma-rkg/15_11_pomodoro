# Pomodoro Art

A Pomodoro timer with a twist: while you focus, a real painting from the Metropolitan Museum of Art slowly comes into view.

## What is it?

- A simple timer page that counts down.
- A painting starts out **blurred**. As the time runs down, it gets **clearer a little at a time**.
- When the timer reaches 00:00, the painting is fully sharp and you find out what it is.

## How it works

- **Start:** the timer starts counting down. The Start button turns into Pause.
- **Pause:** stops the countdown. The button turns into Resume.
- **Resume:** carries on from where you stopped.
- **Reset:** puts the timer back to the start. You keep the **same painting**.
- **Timer length:** right now the timer is set to **30 seconds**, so it is quick to try out. A normal Pomodoro is 25 minutes. There is no setting on the page yet to change the length. It is written near the top of `script.js`.
- **At 00:00:**
  - A bell rings once.
  - The painting is fully sharp.
  - The painting's **name, artist and year** appear, with a **link to its page on the Met website**.
  - The **Restart session** button appears. It starts over with a **new painting**.

## Where the paintings come from

- From the Met Museum's free **Collection API**. (An API is a way for one website to share its information with another.)
- **No API key is needed.** (A key is like a password for using a service. The code doesn't use one.)
- Only paintings that are in the **public domain** (free for anyone to use) and have an image are shown.
- The picture, name, artist, year and link all come from the same Met record. Nothing is made up. If the Met doesn't list an artist or year, the page shows "Unknown".

## If something goes wrong

- There is **no friendly error message yet**.
- If the Met doesn't answer, the painting area stays empty.
- The **timer still works**, and so do the buttons and the bell.
- To try again, refresh the page.

## Try it yourself

- Open `index.html` in your web browser.
- There is nothing to install.

## Live link

[add live link here]

## Credits

- Paintings and details: [The Metropolitan Museum of Art](https://www.metmuseum.org/), through its Open Access Collection API.
- Built by [your name]
