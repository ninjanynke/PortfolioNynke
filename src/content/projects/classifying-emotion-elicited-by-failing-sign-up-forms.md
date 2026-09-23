---
title: "Classifying emotion elicited by failing form"
summary: "Applications/websites don't always run as smoothly as desired, which can elicit negative emotions in its users. The field of Human Computer Interaction might be able to benefit from taking the affective state of the user into account during their interactions, to soften such blows. Measuring a user's emotion will, undeniably, raise some ethical questions. In this machine learning project, we focussed on trying to classify the emotions of 20 participants in relation to a two-time failed sign up process."
category: "program-outline"
type: "University work"
tags:
  - "Affective Computing"
  - "Machine Learning"
  - "Programming"
  - "Research"
skills:
  - "Python"
  - "Usability testing"
startDate: "2019-02-01"
endDate: "2019-06-01"
featured: false
featuredTag: "Machine Learning"
cover: "./classifying-emotion-elicited-by-failing-sign-up-forms/images/failedformthumbnail.png"
draft: false
methodPair:
  - src: "./classifying-emotion-elicited-by-failing-sign-up-forms/images/form.jpg"
    caption: "The failing form that users filled in 3 times before it succeeded. They filled it in under the pretence of joining a different kind of study."
---

## Method

Previous papers have identified annoying factors in HCI, such as persistent pop-ups. With this university project, we tried to determine whether negative emotions, caused by annoying factors, can actually be measured. As mentioned briefly, participants of our experiment had to fill-in a sign up form that failed two times before succeeding, making them lose their information two times. We had several questions with regards to participants' emotions during this experience, such as: "How accurately can heart rate, galvanic skin response (sweat) and action units (sets of facial muscles) classify disappointment and frustration?'' and ''Which measurement (combination) works best in differing these emotions?''

We assumed that users would feel disappointment on the first time of losing their information and frustration after the second time. We made them fill in a post session questionnaire to test this assumption and verify a ground truth. We also measured their action units, heart rate and galvanic skin response during the experiment and used these features in various machine learning algorithms to classify between feelings of a neutral state (i.e. their state before starting to fill in the form), their ''after'' first submit state and ''after'' second submit state.

After data collection, we trained five machine learning models: Decision Trees (standard, random forests, LightGBM), Support Vector Machines and Logistic Regression. We made sure that we divided the data into training (75%) and test (25%) data in a fair way, using StratifiedShuffleSplit for a balanced test set. Our final tables and confusion matrices can be found in the paper, following this [link](https://www.researchgate.net/publication/335158621_Classification_of_Disappointment_and_Frustration_Elicited_by_Human-Computer_Interaction_Towards_Affective_HCI).

## Conclusion and future plans

Picard, a researcher in the HCI field, proposed that taking a user's affective state into account and making an application respond to this accordingly, could soften or avoid negative states in a user. While we don't have an answer on whether this is the way to go or not, we looked into whether at least these affective states could be measured. Our results show that the neutral, first submit and second submit state of users could be distinguished from each other with an accuracy of 64% using Support Vector Machine and Logistic Regression classifiers. Furthermore, the results show that a combination of physiological (GSR and HR) and facial expression features (AU) yield the best accuracy, i.e. better than classifying by separating these from each other. GSR was the most important feature in our models.

As for the separate states, the neutral state was by far the easiest to classify correctly. Distinguishing between disappointment and frustration was harder, as these emotions are more similar and blended together for our users. From our post-session questionnaire, we knew that there were differences between the motions that were felt after the first and second submit. While the self-reported emotions felt after the first submit included confusion, neutral and disappointment, the emotions after the second submit included frustration too, instead of neutral. This does indicate the users felt more frustrated after the second than the first submit, proving our assumption.

Obviously, the accuracy of our model is something to be improved upon: our dataset was quite small, we did not explore all the different action units that we measured and there are more algorithms out there to try out. However, the project taught me a lot about processing data on emotion, something I'd never done before. It was quite challenging to make sure that the measurements were taken from the right timestamps of each participant and combined correctly with each other. This project definitely proved what you always hear when it comes to data science/machine learning projects: most time is spent on pre-processing the data.
