from dataclasses import field
from contacts.models import Contact
from django import forms
from django.db import models

class ContactForm(forms.Form):
    class Pays(models.TextChoices):
      cameroun=+237
      france=+1
      guinee=+231
    nom=forms.CharField(max_length=100)
    numero_telephone=forms.IntegerField()
    prenom=forms.CharField(max_length=50)
    pays=forms.CharField(max_length=10)
    email=forms.EmailField()
    def save(self):
       data=self.cleaned_data
       object=Contact(nom=data['nom'],prenom=data['prenom'],numero_telephone=data['numero_telephone'],pays=data['pays'],email=data['email'])
       object.save()