import email
from django.db import models

class Contact(models.Model):
  class Pays(models.TextChoices):
    cameroun=+237
    france=+1
    guinee=+231

  nom=models.fields.CharField(max_length=100)
  numero_telephone=models.fields.IntegerField(default=100,)
  prenom=models.fields.CharField(max_length=50)
  pays=models.fields.CharField(choices=Pays.choices,max_length=10)
  email=models.fields.EmailField()

# Create your models here.
